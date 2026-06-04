package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"config-server/internal/config"
	"config-server/internal/etcd"
	"config-server/internal/model"
	"config-server/internal/redis"
	"config-server/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.etcd.io/etcd/api/v3/mvccpb"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WSMessage struct {
	Type    string      `json:"type"`
	Key     string      `json:"key,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Version int         `json:"version,omitempty"`
}

type ConfigHandler struct {
	etcdStore  *etcd.Store
	redisCache *redis.Cache
	cfg        *config.Config
	hub        *WSHub
	watcher    *etcd.Watcher
}

func NewConfigHandler(etcdStore *etcd.Store, redisCache *redis.Cache, cfg *config.Config) *ConfigHandler {
	hub := NewWSHub()
	go hub.Run()

	h := &ConfigHandler{
		etcdStore:  etcdStore,
		redisCache: redisCache,
		cfg:        cfg,
		hub:        hub,
	}

	watcher := etcdStore.NewWatcher(context.Background())
	h.watcher = watcher

	go h.dispatchWatchEvents()

	return h
}

func (h *ConfigHandler) getOperator(c *gin.Context) string {
	operator := c.GetHeader("X-Operator")
	if operator == "" {
		operator = "anonymous"
	}
	return operator
}

func (h *ConfigHandler) dispatchWatchEvents() {
	for events := range h.watcher.Events {
		for _, event := range events {
			eventType := "UPDATE"
			if event.Type == mvccpb.DELETE {
				eventType = "DELETE"
			}

			watchEvent := &model.WatchEvent{
				Type:   eventType,
				Key:    event.Key,
				Config: event.Config,
			}

			h.hub.Broadcast(event.Key, watchEvent)

			h.redisCache.Delete(context.Background(), event.Key)
		}
	}
}

func (h *ConfigHandler) CreateConfig(c *gin.Context) {
	var req model.CreateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Format == "" {
		req.Format = "json"
	}

	if req.Encrypted && h.cfg.Encryption.Key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "encryption not configured on server"})
		return
	}

	item, err := h.etcdStore.Create(c.Request.Context(), req.Key, req.Value, req.Format, req.Encrypted)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.recordAudit(c, "CREATE", req.Key, nil, req.Value, item.Version)

	c.JSON(http.StatusCreated, item)
}

func (h *ConfigHandler) GetConfig(c *gin.Context) {
	key := c.Param("key")
	format := c.DefaultQuery("format", "json")

	cached, err := h.redisCache.Get(c.Request.Context(), key)
	if err == nil && cached != nil {
		h.respondWithFormat(c, format, cached)
		return
	}

	item, err := h.etcdStore.Get(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "config not found"})
		return
	}

	h.redisCache.Set(c.Request.Context(), key, item)
	h.respondWithFormat(c, format, item)
}

func (h *ConfigHandler) respondWithFormat(c *gin.Context, format string, data interface{}) {
	if format == "yaml" {
		yamlData, err := utils.JSONToYAML(data)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Data(http.StatusOK, "application/yaml", yamlData)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ConfigHandler) UpdateConfig(c *gin.Context) {
	key := c.Param("key")

	var req model.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Format == "" {
		req.Format = "json"
	}

	if req.Encrypted && h.cfg.Encryption.Key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "encryption not configured on server"})
		return
	}

	oldItem, _ := h.etcdStore.Get(c.Request.Context(), key)
	var oldValue map[string]interface{}
	if oldItem != nil {
		oldValue = oldItem.Value
	}

	item, err := h.etcdStore.Update(c.Request.Context(), key, req.Value, req.Format, req.Encrypted)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.recordAudit(c, "UPDATE", key, oldValue, req.Value, item.Version)

	h.redisCache.Delete(c.Request.Context(), key)
	c.JSON(http.StatusOK, item)
}

func (h *ConfigHandler) DeleteConfig(c *gin.Context) {
	key := c.Param("key")

	oldItem, _ := h.etcdStore.Get(c.Request.Context(), key)
	var oldValue map[string]interface{}
	if oldItem != nil {
		oldValue = oldItem.Value
	}

	if err := h.etcdStore.Delete(c.Request.Context(), key); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.recordAudit(c, "DELETE", key, oldValue, nil, 0)

	h.redisCache.Delete(c.Request.Context(), key)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *ConfigHandler) ListConfigs(c *gin.Context) {
	items, err := h.etcdStore.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *ConfigHandler) GetVersions(c *gin.Context) {
	key := c.Param("key")

	versions, err := h.etcdStore.GetVersions(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, versions)
}

func (h *ConfigHandler) RollbackConfig(c *gin.Context) {
	key := c.Param("key")

	var req model.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	oldItem, _ := h.etcdStore.Get(c.Request.Context(), key)
	var oldValue map[string]interface{}
	if oldItem != nil {
		oldValue = oldItem.Value
	}

	item, err := h.etcdStore.Rollback(c.Request.Context(), key, req.Version)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.recordAudit(c, "ROLLBACK", key, oldValue, item.Value, item.Version)

	h.redisCache.Delete(c.Request.Context(), key)
	c.JSON(http.StatusOK, item)
}

func (h *ConfigHandler) recordAudit(c *gin.Context, action, key string, oldValue, newValue map[string]interface{}, version int) {
	auditLog := &model.AuditLog{
		Key:      key,
		Action:   action,
		Operator: h.getOperator(c),
		OldValue: oldValue,
		NewValue: newValue,
		Version:  version,
	}

	if err := h.etcdStore.RecordAudit(c.Request.Context(), auditLog); err != nil {
		log.Printf("Failed to record audit log: %v", err)
	}
}

func (h *ConfigHandler) QueryAuditLogs(c *gin.Context) {
	var query model.AuditQueryRequest
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	logs, err := h.etcdStore.QueryAuditLogs(c.Request.Context(), &query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, logs)
}

func (h *ConfigHandler) HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := NewWSClient(h.hub, conn)
	h.hub.Register(client)

	go client.WritePump()
	go h.readPump(client)

	h.sendFullSync(client)
}

func (h *ConfigHandler) readPump(client *WSClient) {
	defer func() {
		h.hub.Unregister(client)
		client.Close()
		client.conn.Close()
	}()

	client.conn.SetReadLimit(4096)
	client.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	client.conn.SetPongHandler(func(string) error {
		client.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := client.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			return
		}

		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "subscribe":
			if msg.Key != "" {
				client.Subscribe(msg.Key)
				h.sendSingleConfig(client, msg.Key)
			}
		case "unsubscribe":
			if msg.Key != "" {
				client.Unsubscribe(msg.Key)
			}
		case "sync":
			h.sendFullSync(client)
		}
	}
}

func (h *ConfigHandler) sendFullSync(client *WSClient) {
	items, err := h.etcdStore.List(context.Background())
	if err != nil {
		log.Printf("Failed to list configs for full sync: %v", err)
		return
	}

	msg := WSMessage{
		Type: "full_sync",
		Data: items,
	}
	data, _ := json.Marshal(msg)

	select {
	case client.send <- data:
	default:
		log.Printf("Client send buffer full during full sync, dropping client")
		go h.hub.forceUnregister(client)
	}
}

func (h *ConfigHandler) sendSingleConfig(client *WSClient, key string) {
	item, err := h.etcdStore.Get(context.Background(), key)
	if err != nil {
		return
	}

	msg := WSMessage{
		Type:    "config",
		Key:     key,
		Data:    item,
		Version: item.Version,
	}
	data, _ := json.Marshal(msg)

	select {
	case client.send <- data:
	default:
	}
}
