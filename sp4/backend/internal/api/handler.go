package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wuwenbo/rdt-simulator/backend/internal/model"
	"github.com/wuwenbo/rdt-simulator/backend/internal/simulator"
	"github.com/wuwenbo/rdt-simulator/backend/internal/storage"
)

type Handler struct {
	store *storage.Storage
	sim   *simulator.Simulator
	hub   *simulator.WSHub
}

func NewHandler(store *storage.Storage, sim *simulator.Simulator, hub *simulator.WSHub) *Handler {
	return &Handler{
		store: store,
		sim:   sim,
		hub:   hub,
	}
}

func (h *Handler) SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		system := api.Group("/system")
		{
			system.GET("/metrics", h.GetSystemMetrics)
			system.GET("/config", h.GetSystemConfig)
			system.PUT("/config", h.UpdateSystemConfig)
		}

		processes := api.Group("/processes")
		{
			processes.GET("", h.GetProcesses)
			processes.POST("", h.CreateProcess)
			processes.GET("/:id", h.GetProcess)
			processes.PUT("/:id", h.UpdateProcess)
			processes.DELETE("/:id", h.DeleteProcess)
			processes.GET("/:id/history", h.GetProcessHistory)
		}

		api.GET("/rmid/stats", h.GetRMIDStats)
		api.GET("/cat/allocations", h.GetCATAllocations)

		clos := api.Group("/clos")
		{
			clos.GET("", h.GetCLOSGroups)
			clos.POST("", h.CreateCLOSGroup)
			clos.PUT("/:id", h.UpdateCLOSGroup)
			clos.DELETE("/:id", h.DeleteCLOSGroup)
		}

		sim := api.Group("/simulator")
		{
			sim.GET("/status", h.GetSimulatorStatus)
			sim.POST("/start", h.StartSimulator)
			sim.POST("/stop", h.StopSimulator)
		}
	}
}

func (h *Handler) GetSystemMetrics(c *gin.Context) {
	metrics := h.store.GetSystemMetrics()
	c.JSON(http.StatusOK, metrics)
}

func (h *Handler) GetSystemConfig(c *gin.Context) {
	cfg := h.store.GetConfig()
	c.JSON(http.StatusOK, cfg)
}

func (h *Handler) UpdateSystemConfig(c *gin.Context) {
	var cfg model.SystemConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.store.UpdateConfig(&cfg)
	updated := h.store.GetConfig()
	c.JSON(http.StatusOK, updated)
}

func (h *Handler) GetProcesses(c *gin.Context) {
	procs := h.store.GetAllProcesses()
	c.JSON(http.StatusOK, procs)
}

func (h *Handler) CreateProcess(c *gin.Context) {
	var req model.CreateProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	proc := h.store.AddProcess(&req)
	c.JSON(http.StatusCreated, proc)
}

func (h *Handler) GetProcess(c *gin.Context) {
	pid, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pid"})
		return
	}
	proc := h.store.GetProcess(pid)
	if proc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "process not found"})
		return
	}
	c.JSON(http.StatusOK, proc)
}

func (h *Handler) UpdateProcess(c *gin.Context) {
	pid, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pid"})
		return
	}
	var req model.UpdateProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	proc := h.store.UpdateProcess(pid, &req)
	if proc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "process not found"})
		return
	}
	c.JSON(http.StatusOK, proc)
}

func (h *Handler) DeleteProcess(c *gin.Context) {
	pid, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pid"})
		return
	}
	if !h.store.DeleteProcess(pid) {
		c.JSON(http.StatusNotFound, gin.H{"error": "process not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *Handler) GetProcessHistory(c *gin.Context) {
	pid, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pid"})
		return
	}
	durationStr := c.DefaultQuery("duration", "5m")
	duration, err := time.ParseDuration(durationStr)
	if err != nil {
		duration = 5 * time.Minute
	}
	history := h.store.GetProcessHistory(pid, duration)
	c.JSON(http.StatusOK, history)
}

func (h *Handler) GetCLOSGroups(c *gin.Context) {
	groups := h.store.GetAllCLOSGroups()
	c.JSON(http.StatusOK, groups)
}

func (h *Handler) CreateCLOSGroup(c *gin.Context) {
	var req model.CreateCLOSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	clos := h.store.AddCLOSGroup(&req)
	c.JSON(http.StatusCreated, clos)
}

func (h *Handler) UpdateCLOSGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req model.UpdateCLOSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	clos := h.store.UpdateCLOSGroup(id, &req)
	if clos == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "clos group not found"})
		return
	}
	c.JSON(http.StatusOK, clos)
}

func (h *Handler) DeleteCLOSGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if !h.store.DeleteCLOSGroup(id) {
		c.JSON(http.StatusNotFound, gin.H{"error": "clos group not found or cannot delete default"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *Handler) GetSimulatorStatus(c *gin.Context) {
	status := h.store.GetSimulatorStatus()
	c.JSON(http.StatusOK, status)
}

func (h *Handler) StartSimulator(c *gin.Context) {
	h.sim.Start()
	status := h.store.GetSimulatorStatus()
	c.JSON(http.StatusOK, status)
}

func (h *Handler) StopSimulator(c *gin.Context) {
	h.sim.Stop()
	status := h.store.GetSimulatorStatus()
	c.JSON(http.StatusOK, status)
}

func (h *Handler) GetRMIDStats(c *gin.Context) {
	metrics := h.store.GetSystemMetrics()
	c.JSON(http.StatusOK, metrics.RMIDStats)
}

func (h *Handler) GetCATAllocations(c *gin.Context) {
	metrics := h.store.GetSystemMetrics()
	c.JSON(http.StatusOK, metrics.CATAllocations)
}
