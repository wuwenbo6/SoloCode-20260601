package api

import (
	"3d-printer-controller/internal/database"
	"3d-printer-controller/internal/models"
	"3d-printer-controller/internal/printer"
	"3d-printer-controller/internal/transport"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type API struct {
	pm         *printer.PrinterManager
	wtServer   *transport.WebTransportServer
	fwUpgrade  *printer.FirmwareUpgrade
}

func NewAPI() *API {
	pm := printer.GetPrinterManager()
	return &API{
		pm:        pm,
		wtServer:  transport.GetWebTransportServer(),
		fwUpgrade: printer.NewFirmwareUpgrade(pm),
	}
}

func (a *API) SetupRoutes(r *gin.Engine) {
	r.Use(CORS())

	api := r.Group("/api")
	{
		api.GET("/status", a.GetStatus)
		api.GET("/firmware-info", a.GetFirmwareInfo)
		api.GET("/connection", a.GetConnectionStatus)
		api.POST("/connect", a.ConnectPrinter)
		api.POST("/disconnect", a.DisconnectPrinter)
		api.POST("/auto-reconnect", a.SetAutoReconnect)

		api.POST("/command", a.SendCommand)

		control := api.Group("/control")
		{
			control.POST("/pause", a.PausePrint)
			control.POST("/resume", a.ResumePrint)
			control.POST("/stop", a.StopPrint)
			control.POST("/move", a.MoveAxis)
			control.POST("/home", a.HomeAxis)
			control.POST("/temperature", a.SetTemperature)
			control.POST("/start-print", a.StartPrintJob)
		}

		api.GET("/ws/status", a.StatusWebSocket)

		video := api.Group("/video")
		{
			video.GET("/ws", func(c *gin.Context) {
				a.wtServer.HandleWebSocket(c.Writer, c.Request)
			})
			video.POST("/start", a.StartVideoStream)
			video.POST("/stop", a.StopVideoStream)
			video.GET("/info", a.GetVideoInfo)
		}

		firmware := api.Group("/firmware")
		{
			firmware.POST("/upload", a.UploadFirmware)
			firmware.POST("/start", a.StartFirmwareUpgrade)
			firmware.POST("/pause", a.PauseFirmwareUpgrade)
			firmware.POST("/resume", a.ResumeFirmwareUpgrade)
			firmware.POST("/reset", a.ResetFirmwareUpgrade)
			firmware.GET("/progress", a.GetFirmwareProgress)
			firmware.POST("/cancel", a.CancelFirmwareUpgrade)
		}

		history := api.Group("/history")
		{
			history.GET("", a.GetPrintHistory)
			history.GET("/:id", a.GetPrintJob)
			history.DELETE("/:id", a.DeletePrintJob)
		}
	}
}

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func (a *API) GetStatus(c *gin.Context) {
	status := a.pm.GetStatus()
	c.JSON(http.StatusOK, status)
}

func (a *API) GetFirmwareInfo(c *gin.Context) {
	info := a.pm.GetFirmwareInfo()
	if info == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No firmware info available"})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (a *API) GetConnectionStatus(c *gin.Context) {
	state := a.pm.GetConnectionState()
	c.JSON(http.StatusOK, state)
}

func (a *API) SetAutoReconnect(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	a.pm.SetAutoReconnect(req.Enabled)
	c.JSON(http.StatusOK, gin.H{"status": "ok", "autoReconnect": req.Enabled})
}

func (a *API) ConnectPrinter(c *gin.Context) {
	var req struct {
		Type string `json:"type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	connType := printer.ConnSimulator
	if req.Type == "webusb" {
		connType = printer.ConnWebUSB
	} else if req.Type == "serial" {
		connType = printer.ConnSerial
	}

	err := a.pm.Connect(connType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"connected": true,
		"type":      connType,
	})
}

func (a *API) DisconnectPrinter(c *gin.Context) {
	a.pm.Disconnect()
	c.JSON(http.StatusOK, gin.H{"connected": false})
}

func (a *API) SendCommand(c *gin.Context) {
	var req struct {
		Command string `json:"command"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := a.pm.SendCommand(req.Command)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"response": resp})
}

func (a *API) PausePrint(c *gin.Context) {
	err := a.pm.PausePrint()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "paused"})
}

func (a *API) ResumePrint(c *gin.Context) {
	err := a.pm.ResumePrint()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "resumed"})
}

func (a *API) StopPrint(c *gin.Context) {
	err := a.pm.StopPrint()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "stopped"})
}

func (a *API) MoveAxis(c *gin.Context) {
	var move models.AxisMove
	if err := c.ShouldBindJSON(&move); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := a.pm.MoveAxis(&move)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (a *API) HomeAxis(c *gin.Context) {
	var req struct {
		Axis string `json:"axis"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Axis = "ALL"
	}

	err := a.pm.HomeAxis(req.Axis)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (a *API) SetTemperature(c *gin.Context) {
	var req struct {
		Heater string  `json:"heater"`
		Temp   float64 `json:"temp"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := a.pm.SetTemperature(req.Heater, req.Temp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (a *API) StartPrintJob(c *gin.Context) {
	var req struct {
		FileName string `json:"file_name"`
		FileSize int64  `json:"file_size"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.FileName == "" {
		req.FileName = "print_job_" + time.Now().Format("20060102_150405") + ".gcode"
	}

	jobID, err := a.pm.StartPrintJob(req.FileName, req.FileSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"job_id": jobID,
		"status": "started",
	})
}

func (a *API) StatusWebSocket(c *gin.Context) {
	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	clientID := uuid.New().String()
	statusChan := a.pm.AddStatusListener(clientID)
	defer a.pm.RemoveStatusListener(clientID)

	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	for status := range statusChan {
		data, err := json.Marshal(status)
		if err != nil {
			continue
		}
		err = conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			return
		}
	}
}

func (a *API) StartVideoStream(c *gin.Context) {
	a.wtServer.StartStream()
	c.JSON(http.StatusOK, gin.H{"status": "started"})
}

func (a *API) StopVideoStream(c *gin.Context) {
	a.wtServer.StopStream()
	c.JSON(http.StatusOK, gin.H{"status": "stopped"})
}

func (a *API) GetVideoInfo(c *gin.Context) {
	info := a.wtServer.GetStreamInfo()
	c.JSON(http.StatusOK, info)
}

func (a *API) UploadFirmware(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"size":    len(content),
		"content": string(content),
	})
}

func (a *API) StartFirmwareUpgrade(c *gin.Context) {
	var req struct {
		HexContent string `json:"hex_content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if a.fwUpgrade.IsInProgress() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Upgrade already in progress"})
		return
	}

	progressChan := make(chan float64, 10)
	errorChan := make(chan error, 1)

	go a.fwUpgrade.PerformFullUpgrade(req.HexContent, progressChan, errorChan)

	go func() {
		for range progressChan {
		}
		for range errorChan {
		}
	}()

	c.JSON(http.StatusOK, gin.H{"status": "started"})
}

func (a *API) GetFirmwareProgress(c *gin.Context) {
	progress, current, total, lastErr := a.fwUpgrade.GetProgress()
	resumeState := a.fwUpgrade.GetResumeState()
	c.JSON(http.StatusOK, gin.H{
		"progress":     progress,
		"currentPage":  current,
		"totalPages":   total,
		"inProgress":   a.fwUpgrade.IsInProgress(),
		"paused":       a.fwUpgrade.IsPaused(),
		"lastError":    lastErr,
		"maxRetries":   a.fwUpgrade.GetMaxRetries(),
		"resumeState":  resumeState,
	})
}

func (a *API) PauseFirmwareUpgrade(c *gin.Context) {
	a.fwUpgrade.Pause()
	c.JSON(http.StatusOK, gin.H{"status": "paused"})
}

func (a *API) ResumeFirmwareUpgrade(c *gin.Context) {
	var req struct {
		HexContent string `json:"hex_content"`
	}
	if err := c.ShouldBindJSON(&req); err == nil && req.HexContent != "" {
		a.fwUpgrade.Start(req.HexContent)
	} else {
		a.fwUpgrade.Start("")
	}
	c.JSON(http.StatusOK, gin.H{"status": "resumed"})
}

func (a *API) ResetFirmwareUpgrade(c *gin.Context) {
	a.fwUpgrade.Reset()
	c.JSON(http.StatusOK, gin.H{"status": "reset"})
}

func (a *API) CancelFirmwareUpgrade(c *gin.Context) {
	a.fwUpgrade.Cancel()
	c.JSON(http.StatusOK, gin.H{"status": "cancelled"})
}

func (a *API) GetPrintHistory(c *gin.Context) {
	limit := 20
	offset := 0

	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil {
			offset = parsed
		}
	}

	jobs, total, err := database.GetAllPrintJobs(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"jobs":  jobs,
		"total": total,
		"limit": limit,
		"offset": offset,
	})
}

func (a *API) GetPrintJob(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid job ID"})
		return
	}

	job, err := database.GetPrintJobByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

func (a *API) DeletePrintJob(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid job ID"})
		return
	}

	err = database.DeletePrintJob(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
