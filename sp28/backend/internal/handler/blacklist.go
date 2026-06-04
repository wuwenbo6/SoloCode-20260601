package handler

import (
	"net/http"
	"strconv"

	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/service"

	"github.com/gin-gonic/gin"
)

type BlacklistHandler struct {
	interceptor   *service.CommandInterceptor
	blacklistRepo interface {
		FindAll() ([]model.CommandBlacklist, error)
		FindByID(id uint) (*model.CommandBlacklist, error)
		Create(rule *model.CommandBlacklist) error
		Update(rule *model.CommandBlacklist) error
		Delete(id uint) error
	}
}

func NewBlacklistHandler(interceptor *service.CommandInterceptor, blacklistRepo interface {
	FindAll() ([]model.CommandBlacklist, error)
	FindByID(id uint) (*model.CommandBlacklist, error)
	Create(rule *model.CommandBlacklist) error
	Update(rule *model.CommandBlacklist) error
	Delete(id uint) error
}) *BlacklistHandler {
	return &BlacklistHandler{
		interceptor:   interceptor,
		blacklistRepo: blacklistRepo,
	}
}

func (h *BlacklistHandler) GetRules(c *gin.Context) {
	rules, err := h.blacklistRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rules})
}

func (h *BlacklistHandler) GetRule(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	rule, err := h.blacklistRepo.FindByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rule})
}

func (h *BlacklistHandler) CreateRule(c *gin.Context) {
	var rule model.CommandBlacklist
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.blacklistRepo.Create(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.interceptor.RefreshPatterns()
	c.JSON(http.StatusCreated, gin.H{"data": rule})
}

func (h *BlacklistHandler) UpdateRule(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	rule, err := h.blacklistRepo.FindByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	if err := c.ShouldBindJSON(rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.blacklistRepo.Update(rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.interceptor.RefreshPatterns()
	c.JSON(http.StatusOK, gin.H{"data": rule})
}

func (h *BlacklistHandler) DeleteRule(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.blacklistRepo.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.interceptor.RefreshPatterns()
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *BlacklistHandler) RefreshPatterns(c *gin.Context) {
	h.interceptor.RefreshPatterns()
	c.JSON(http.StatusOK, gin.H{"message": "refreshed"})
}
