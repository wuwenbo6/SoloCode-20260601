package handler

import (
	"net/http"
	"strconv"

	"ssh-web-terminal/internal/model"

	"github.com/gin-gonic/gin"
)

type JumpHostHandler struct {
	jumpHostRepo interface {
		FindAll() ([]model.JumpHost, error)
		FindByID(id uint) (*model.JumpHost, error)
		Create(host *model.JumpHost) error
		Update(host *model.JumpHost) error
		Delete(id uint) error
	}
}

func NewJumpHostHandler(jumpHostRepo interface {
	FindAll() ([]model.JumpHost, error)
	FindByID(id uint) (*model.JumpHost, error)
	Create(host *model.JumpHost) error
	Update(host *model.JumpHost) error
	Delete(id uint) error
}) *JumpHostHandler {
	return &JumpHostHandler{jumpHostRepo: jumpHostRepo}
}

func (h *JumpHostHandler) GetAll(c *gin.Context) {
	hosts, err := h.jumpHostRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": hosts})
}

func (h *JumpHostHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	host, err := h.jumpHostRepo.FindByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "jump host not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": host})
}

func (h *JumpHostHandler) Create(c *gin.Context) {
	var host model.JumpHost
	if err := c.ShouldBindJSON(&host); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.jumpHostRepo.Create(&host); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": host})
}

func (h *JumpHostHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	host, err := h.jumpHostRepo.FindByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "jump host not found"})
		return
	}

	if err := c.ShouldBindJSON(host); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.jumpHostRepo.Update(host); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": host})
}

func (h *JumpHostHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.jumpHostRepo.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
