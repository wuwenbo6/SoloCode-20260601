package handler

import (
	"net/http"
	"strconv"

	"ssh-web-terminal/internal/middleware"
	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/service"

	"github.com/gin-gonic/gin"
)

type SessionHandler struct {
	sessionSvc *service.SessionService
}

func NewSessionHandler(sessionSvc *service.SessionService) *SessionHandler {
	return &SessionHandler{sessionSvc: sessionSvc}
}

func (h *SessionHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	role := middleware.GetRole(c)

	var sessions []model.Session
	var err error

	if role == "admin" {
		sessions, err = h.sessionSvc.List()
	} else {
		sessions, err = h.sessionSvc.ListByUser(userID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for i := range sessions {
		sessions[i].Server.Password = ""
	}

	c.JSON(http.StatusOK, sessions)
}

func (h *SessionHandler) Get(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	session, err := h.sessionSvc.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	userID := middleware.GetUserID(c)
	role := middleware.GetRole(c)

	if role != "admin" && session.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	session.Server.Password = ""
	c.JSON(http.StatusOK, session)
}

func (h *SessionHandler) ListMy(c *gin.Context) {
	userID := middleware.GetUserID(c)
	sessions, err := h.sessionSvc.ListByUser(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for i := range sessions {
		sessions[i].Server.Password = ""
	}

	c.JSON(http.StatusOK, sessions)
}
