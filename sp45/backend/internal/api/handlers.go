package api

import (
	"3d-printer-controller/internal/database"
	"3d-printer-controller/internal/detection"
	"3d-printer-controller/internal/models"
	"3d-printer-controller/internal/printer"
	"3d-printer-controller/internal/transport"
	"3d-printer-controller/pkg/gcode"
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
	hub        *printer.MultiPrinterHub
	wtServer   *transport.WebTransportServer
	detector   *detection.PrintFailureDetector
}

func NewAPI() *API {
	hub := printer.GetMultiPrinterHub()
	return &API{
		hub:      hub,
		wtServer: transport.GetWebTransportServer(),
		detector: detection.NewPrintFailureDetector(),
	}
}

func (a *API) getActivePM() *printer.PrinterManager {
	inst := a.hub.GetActivePrinter()
	if inst == nil {
		return nil
	}
	return inst.Manager
}

func (a *API) getActiveFW() *printer.FirmwareUpgrade {
	inst := a.hub.GetActivePrinter()
	if inst == nil {
		return nil
	}
	return inst.FirmwareUpgrade
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

		printers := api.Group("/printers")
		{
			printers.GET("", a.ListPrinters)
			printers.POST("", a.AddPrinter)
			printers.DELETE("/:id", a.RemovePrinter)
			printers.PUT("/active/:id", a.SetActivePrinter)
			printers.GET("/:id/status", a.GetPrinterStatus)
		}

		video := api.Group("/video")
		{
			video.GET("/ws", func(c *gin.Context) {
				a.wtServer.HandleWebSocket(c.Writer, c.Request)
			})
			video.POST("/start", a.StartVideoStream)
			video.POST("/stop", a.StopVideoStream)
			video.GET("/info", a.GetVideoInfo)
		}

		detection := api.Group("/detection")
		{
			detection.GET("/alerts", a.GetDetectionAlerts)
			detection.GET("/config", a.GetDetectionConfig)
			detection.PUT("/config", a.UpdateDetectionConfig)
			detection.POST("/clear", a.ClearDetectionAlerts)
			detection.GET("/ws", a.DetectionWebSocket)
		}

		gcodeGroup := api.Group("/gcode")
		{
			gcodeGroup.POST("/preview", a.GCodePreview)
			gcodeGroup.POST("/upload", a.UploadGCode)
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
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	status := pm.GetStatus()
	c.JSON(http.StatusOK, status)
}

func (a *API) GetFirmwareInfo(c *gin.Context) {
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	info := pm.GetFirmwareInfo()
	if info == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No firmware info available"})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (a *API) GetConnectionStatus(c *gin.Context) {
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusOK, gin.H{"status": "disconnected", "connected": false})
		return
	}
	state := pm.GetConnectionState()
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
	pm := a.getActivePM()
	if pm != nil {
		pm.SetAutoReconnect(req.Enabled)
	}
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

	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}

	err := pm.Connect(connType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"connected": true, "type": connType})
}

func (a *API) DisconnectPrinter(c *gin.Context) {
	pm := a.getActivePM()
	if pm != nil {
		pm.Disconnect()
	}
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
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	resp, err := pm.SendCommand(req.Command)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"response": resp})
}

func (a *API) PausePrint(c *gin.Context) {
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	err := pm.PausePrint()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "paused"})
}

func (a *API) ResumePrint(c *gin.Context) {
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	err := pm.ResumePrint()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "resumed"})
}

func (a *API) StopPrint(c *gin.Context) {
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	err := pm.StopPrint()
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
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	err := pm.MoveAxis(&move)
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
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	err := pm.HomeAxis(req.Axis)
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
	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	err := pm.SetTemperature(req.Heater, req.Temp)
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

	pm := a.getActivePM()
	if pm == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	jobID, err := pm.StartPrintJob(req.FileName, req.FileSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"job_id": jobID, "status": "started"})
}

func (a *API) StatusWebSocket(c *gin.Context) {
	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	pm := a.getActivePM()
	if pm == nil {
		return
	}

	clientID := uuid.New().String()
	statusChan := pm.AddStatusListener(clientID)
	defer pm.RemoveStatusListener(clientID)

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

func (a *API) ListPrinters(c *gin.Context) {
	printers := a.hub.GetAllPrinters()
	c.JSON(http.StatusOK, gin.H{"printers": printers, "active": a.hub.GetActiveID()})
}

func (a *API) AddPrinter(c *gin.Context) {
	var req struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Type string `json:"type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ID == "" {
		req.ID = "printer-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	if req.Name == "" {
		req.Name = "打印机 " + req.ID
	}

	connType := printer.ConnSimulator
	inst, err := a.hub.AddPrinter(req.ID, req.Name, connType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": inst.ID, "name": inst.Name, "status": "created"})
}

func (a *API) RemovePrinter(c *gin.Context) {
	id := c.Param("id")
	err := a.hub.RemovePrinter(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (a *API) SetActivePrinter(c *gin.Context) {
	id := c.Param("id")
	err := a.hub.SetActivePrinter(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "active": id})
}

func (a *API) GetPrinterStatus(c *gin.Context) {
	id := c.Param("id")
	inst := a.hub.GetPrinter(id)
	if inst == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "printer not found"})
		return
	}
	status := inst.Manager.GetStatus()
	c.JSON(http.StatusOK, status)
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

func (a *API) GetDetectionAlerts(c *gin.Context) {
	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	alerts := a.detector.GetAlerts(limit)
	c.JSON(http.StatusOK, gin.H{"alerts": alerts, "enabled": a.detector.IsEnabled()})
}

func (a *API) GetDetectionConfig(c *gin.Context) {
	config := a.detector.GetConfig()
	c.JSON(http.StatusOK, config)
}

func (a *API) UpdateDetectionConfig(c *gin.Context) {
	var config detection.DetectionConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	a.detector.SetConfig(config)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (a *API) ClearDetectionAlerts(c *gin.Context) {
	a.detector.ClearAlerts()
	c.JSON(http.StatusOK, gin.H{"status": "cleared"})
}

func (a *API) DetectionWebSocket(c *gin.Context) {
	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	clientID := uuid.New().String()
	alertChan := a.hub.AddAlertListener(clientID)
	defer a.hub.RemoveAlertListener(clientID)

	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	for alert := range alertChan {
		data, err := json.Marshal(alert)
		if err != nil {
			continue
		}
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			return
		}
	}
}

func (a *API) GCodePreview(c *gin.Context) {
	var req struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty gcode content"})
		return
	}

	preview := gcode.GeneratePreview(req.Content)
	c.JSON(http.StatusOK, preview)
}

func (a *API) UploadGCode(c *gin.Context) {
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

	preview := gcode.GeneratePreview(string(content))
	c.JSON(http.StatusOK, gin.H{
		"size":    len(content),
		"preview": preview,
	})
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

	c.JSON(http.StatusOK, gin.H{"size": len(content), "content": string(content)})
}

func (a *API) StartFirmwareUpgrade(c *gin.Context) {
	var req struct {
		HexContent string `json:"hex_content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fw := a.getActiveFW()
	if fw == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}

	if fw.IsInProgress() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Upgrade already in progress"})
		return
	}

	progressChan := make(chan float64, 10)
	errorChan := make(chan error, 1)

	go fw.PerformFullUpgrade(req.HexContent, progressChan, errorChan)

	go func() {
		for range progressChan {
		}
		for range errorChan {
		}
	}()

	c.JSON(http.StatusOK, gin.H{"status": "started"})
}

func (a *API) GetFirmwareProgress(c *gin.Context) {
	fw := a.getActiveFW()
	if fw == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	progress, current, total, lastErr := fw.GetProgress()
	resumeState := fw.GetResumeState()
	c.JSON(http.StatusOK, gin.H{
		"progress":    progress,
		"currentPage": current,
		"totalPages":  total,
		"inProgress":  fw.IsInProgress(),
		"paused":      fw.IsPaused(),
		"lastError":   lastErr,
		"maxRetries":  fw.GetMaxRetries(),
		"resumeState": resumeState,
	})
}

func (a *API) PauseFirmwareUpgrade(c *gin.Context) {
	fw := a.getActiveFW()
	if fw != nil {
		fw.Pause()
	}
	c.JSON(http.StatusOK, gin.H{"status": "paused"})
}

func (a *API) ResumeFirmwareUpgrade(c *gin.Context) {
	var req struct {
		HexContent string `json:"hex_content"`
	}
	fw := a.getActiveFW()
	if fw == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no active printer"})
		return
	}
	if err := c.ShouldBindJSON(&req); err == nil && req.HexContent != "" {
		fw.Start(req.HexContent)
	} else {
		fw.Start("")
	}
	c.JSON(http.StatusOK, gin.H{"status": "resumed"})
}

func (a *API) ResetFirmwareUpgrade(c *gin.Context) {
	fw := a.getActiveFW()
	if fw != nil {
		fw.Reset()
	}
	c.JSON(http.StatusOK, gin.H{"status": "reset"})
}

func (a *API) CancelFirmwareUpgrade(c *gin.Context) {
	fw := a.getActiveFW()
	if fw != nil {
		fw.Cancel()
	}
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
		"jobs":   jobs,
		"total":  total,
		"limit":  limit,
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
