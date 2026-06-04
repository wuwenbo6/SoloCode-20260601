package handler

import (
	"net/http"
	"strconv"

	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/service"

	"github.com/gin-gonic/gin"
)

type ServerHandler struct {
	serverSvc *service.ServerService
}

func NewServerHandler(serverSvc *service.ServerService) *ServerHandler {
	return &ServerHandler{serverSvc: serverSvc}
}

func (h *ServerHandler) Create(c *gin.Context) {
	var server model.Server
	if err := c.ShouldBindJSON(&server); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.serverSvc.Create(&server); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, server)
}

func (h *ServerHandler) Get(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
		return
	}

	server, err := h.serverSvc.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
		return
	}

	server.Password = ""
	c.JSON(http.StatusOK, server)
}

func (h *ServerHandler) List(c *gin.Context) {
	servers, err := h.serverSvc.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for i := range servers {
		servers[i].Password = ""
	}

	c.JSON(http.StatusOK, servers)
}

func (h *ServerHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
		return
	}

	var server model.Server
	if err := c.ShouldBindJSON(&server); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	server.ID = uint(id)
	if err := h.serverSvc.Update(&server); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	server.Password = ""
	c.JSON(http.StatusOK, server)
}

func (h *ServerHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
		return
	}

	if err := h.serverSvc.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
