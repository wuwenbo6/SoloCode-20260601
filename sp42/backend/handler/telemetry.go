package handler

import (
	"net/http"

	"drone-fpv-backend/service"

	"github.com/gin-gonic/gin"
)

type TelemetryHandler struct {
	ts *service.TelemetryService
	gs *service.GimbalService
}

func NewTelemetryHandler(ts *service.TelemetryService, gs *service.GimbalService) *TelemetryHandler {
	return &TelemetryHandler{
		ts: ts,
		gs: gs,
	}
}

func (h *TelemetryHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.GET("/telemetry", h.GetTelemetry)
		api.GET("/gimbal", h.GetGimbal)
	}
}

func (h *TelemetryHandler) GetTelemetry(c *gin.Context) {
	data := h.ts.GetData()
	angles := h.gs.GetAngles()

	c.JSON(http.StatusOK, gin.H{
		"timestamp": data.Timestamp,
		"altitude":  data.Altitude,
		"speed":     data.Speed,
		"latitude":  data.Latitude,
		"longitude": data.Longitude,
		"battery":   data.Battery,
		"signal":    data.Signal,
		"heading":   data.Heading,
		"mode":      data.Mode,
		"gimbal": gin.H{
			"yaw":   angles.Yaw,
			"pitch": angles.Pitch,
			"roll":  angles.Roll,
		},
	})
}

func (h *TelemetryHandler) GetGimbal(c *gin.Context) {
	angles := h.gs.GetAngles()
	c.JSON(http.StatusOK, angles)
}
