package handler

import (
	"net/http"

	"drone-fpv-backend/service"

	"github.com/gin-gonic/gin"
)

type StreamHandler struct {
	gs *service.GStreamerService
	wt clientCounter
}

type clientCounter interface {
	ClientCount() int32
}

func NewStreamHandler(gs *service.GStreamerService, wt clientCounter) *StreamHandler {
	return &StreamHandler{
		gs: gs,
		wt: wt,
	}
}

func (h *StreamHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.GET("/stream/status", h.Status)
		api.POST("/stream/start", h.Start)
		api.POST("/stream/stop", h.Stop)
	}
}

func (h *StreamHandler) Status(c *gin.Context) {
	mode := "stopped"
	resolution := ""
	fps := 0
	if h.gs.IsRunning() {
		switch h.gs.Mode() {
		case service.ModeH264:
			mode = "h264"
			resolution = "1280x720"
			fps = 30
		case service.ModeRGBA:
			mode = "rgba"
			resolution = "320x240"
			fps = 30
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"running":     h.gs.IsRunning(),
		"mode":        mode,
		"resolution":  resolution,
		"fps":         fps,
		"clientCount": h.wt.ClientCount(),
		"clients":     []string{},
	})
}

func (h *StreamHandler) Start(c *gin.Context) {
	if h.gs.IsRunning() {
		c.JSON(http.StatusConflict, gin.H{
			"error": "stream already running",
		})
		return
	}

	if err := h.gs.Start(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "started",
		"mode":   modeString(h.gs.Mode()),
	})
}

func (h *StreamHandler) Stop(c *gin.Context) {
	if !h.gs.IsRunning() {
		c.JSON(http.StatusConflict, gin.H{
			"error": "stream not running",
		})
		return
	}

	h.gs.Stop()
	c.JSON(http.StatusOK, gin.H{
		"status": "stopped",
	})
}

func modeString(m service.VideoMode) string {
	switch m {
	case service.ModeH264:
		return "h264"
	case service.ModeRGBA:
		return "rgba"
	default:
		return "unknown"
	}
}
