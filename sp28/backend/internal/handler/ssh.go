package handler

import (
	"net/http"
	"strconv"

	"ssh-web-terminal/internal/middleware"
	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/service"

	"github.com/gin-gonic/gin"
)

type SSHHandler struct {
	sshManager *service.SSHManager
	sessionSvc *service.SessionService
	accessSvc  *service.AccessService
}

func NewSSHHandler(sshManager *service.SSHManager, sessionSvc *service.SessionService, accessSvc *service.AccessService) *SSHHandler {
	return &SSHHandler{
		sshManager: sshManager,
		sessionSvc: sessionSvc,
		accessSvc:  accessSvc,
	}
}

func (h *SSHHandler) Connect(c *gin.Context) {
	serverIDStr := c.Query("server_id")
	serverID, err := strconv.ParseUint(serverIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server_id"})
		return
	}

	userID := middleware.GetUserID(c)
	username, _ := c.Get("username")

	if !h.accessSvc.HasAccess(userID, uint(serverID)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "no active access grant for this server"})
		return
	}

	if err := h.sshManager.Connect(uint(serverID), userID, username.(string), c.Writer, c.Request); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
}

func (h *SSHHandler) Broadcast(c *gin.Context) {
	sessionIDStr := c.Param("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	username, _ := c.Get("username")

	if err := h.sshManager.JoinBroadcast(uint(sessionID), username.(string), c.Writer, c.Request); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
}

func (h *SSHHandler) GetActiveSessions(c *gin.Context) {
	sessions, err := h.sessionSvc.ListActive()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type SessionWithViewers struct {
		*model.Session
		ViewerCount int `json:"viewer_count"`
	}

	result := make([]SessionWithViewers, len(sessions))
	for i, s := range sessions {
		result[i] = SessionWithViewers{
			Session:     &sessions[i],
			ViewerCount: h.sshManager.GetViewerCount(s.ID),
		}
	}

	c.JSON(http.StatusOK, result)
}
