package handler

import (
	"net/http"
	"strconv"

	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/service"

	"github.com/gin-gonic/gin"
)

type PlaybackHandler struct {
	playbackSvc *service.PlaybackService
	sessionSvc  *service.SessionService
	minioSvc    *service.MinIOService
}

func NewPlaybackHandler(playbackSvc *service.PlaybackService, sessionSvc *service.SessionService, minioSvc *service.MinIOService) *PlaybackHandler {
	return &PlaybackHandler{
		playbackSvc: playbackSvc,
		sessionSvc:  sessionSvc,
		minioSvc:    minioSvc,
	}
}

func (h *PlaybackHandler) GetFrames(c *gin.Context) {
	sessionIDStr := c.Param("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	session, err := h.sessionSvc.GetByID(uint(sessionID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	if session.RecordingPath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no recording available"})
		return
	}

	frames, err := h.playbackSvc.LoadRecording(session.RecordingPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]map[string]interface{}, len(frames))
	for i, f := range frames {
		result[i] = map[string]interface{}{
			"index":       i,
			"content":     string(f.Content),
			"delay":       f.Delay,
			"absolute_ts": f.AbsoluteTs,
		}
	}

	duration := h.playbackSvc.GetDuration(frames)
	c.JSON(http.StatusOK, gin.H{
		"frame_count": len(frames),
		"duration":    duration,
		"frames":      result,
	})
}

func (h *PlaybackHandler) GetFramesForSpeed(c *gin.Context) {
	sessionIDStr := c.Param("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	speedStr := c.DefaultQuery("speed", "1.0")
	speed, err := strconv.ParseFloat(speedStr, 64)
	if err != nil || speed <= 0 {
		speed = 1.0
	}

	session, err := h.sessionSvc.GetByID(uint(sessionID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	if session.RecordingPath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no recording available"})
		return
	}

	frames, err := h.playbackSvc.LoadRecording(session.RecordingPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := h.playbackSvc.GetFramesForSpeedWithTimestamps(frames, speed)
	duration := h.playbackSvc.GetDuration(frames)
	c.JSON(http.StatusOK, gin.H{
		"frame_count":       len(frames),
		"duration":          duration,
		"adjusted_duration": duration / speed,
		"speed":             speed,
		"frames":            result,
	})
}

func (h *PlaybackHandler) GetInfo(c *gin.Context) {
	sessionIDStr := c.Param("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	session, err := h.sessionSvc.GetByID(uint(sessionID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	if session.RecordingPath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no recording available"})
		return
	}

	frames, err := h.playbackSvc.LoadRecording(session.RecordingPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fileSize, _ := h.minioSvc.GetObjectSize(session.RecordingPath)
	duration := h.playbackSvc.GetDuration(frames)

	info := model.RecordingInfo{
		ID:            session.ID,
		SessionID:     session.ID,
		Username:      session.User.Username,
		ServerName:    session.Server.Name,
		ServerHost:    session.Server.Host,
		StartTime:     session.StartTime,
		EndTime:       session.EndTime,
		Duration:      duration,
		RecordingPath: session.RecordingPath,
		FileSize:      fileSize,
	}

	c.JSON(http.StatusOK, info)
}

func (h *PlaybackHandler) ListRecordings(c *gin.Context) {
	sessions, err := h.sessionSvc.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var recordings []model.RecordingInfo
	for _, session := range sessions {
		if session.RecordingPath == "" || session.Status == "active" {
			continue
		}

		frames, err := h.playbackSvc.LoadRecording(session.RecordingPath)
		if err != nil {
			continue
		}

		fileSize, _ := h.minioSvc.GetObjectSize(session.RecordingPath)
		duration := h.playbackSvc.GetDuration(frames)

		recordings = append(recordings, model.RecordingInfo{
			ID:            session.ID,
			SessionID:     session.ID,
			Username:      session.User.Username,
			ServerName:    session.Server.Name,
			ServerHost:    session.Server.Host,
			StartTime:     session.StartTime,
			EndTime:       session.EndTime,
			Duration:      duration,
			RecordingPath: session.RecordingPath,
			FileSize:      fileSize,
		})
	}

	c.JSON(http.StatusOK, recordings)
}
