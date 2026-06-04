package handler

import (
	"net/http"
	"strconv"

	"ssh-web-terminal/internal/middleware"
	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/service"

	"github.com/gin-gonic/gin"
)

type AccessHandler struct {
	accessSvc *service.AccessService
}

func NewAccessHandler(accessSvc *service.AccessService) *AccessHandler {
	return &AccessHandler{accessSvc: accessSvc}
}

func (h *AccessHandler) RequestAccess(c *gin.Context) {
	var req model.CreateAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	accessReq, err := h.accessSvc.RequestAccess(userID, req.ServerID, req.Reason, req.Duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, accessReq)
}

func (h *AccessHandler) ApproveRequest(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}

	reviewerID := middleware.GetUserID(c)
	grant, err := h.accessSvc.ApproveRequest(uint(id), reviewerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, grant)
}

func (h *AccessHandler) RejectRequest(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}

	reviewerID := middleware.GetUserID(c)
	if err := h.accessSvc.RejectRequest(uint(id), reviewerID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "rejected"})
}

func (h *AccessHandler) ListRequests(c *gin.Context) {
	status := c.Query("status")
	reqs, err := h.accessSvc.ListRequests(status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, reqs)
}

func (h *AccessHandler) ListMyGrants(c *gin.Context) {
	userID := middleware.GetUserID(c)
	grants, err := h.accessSvc.ListUserGrants(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, grants)
}
