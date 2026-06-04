package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

type WSMessage struct {
	Type         string      `json:"type"`
	SourceID     uint32      `json:"sourceId,omitempty"`
	TemplateID   uint16      `json:"templateId,omitempty"`
	Record       interface{} `json:"record,omitempty"`
	Stats        interface{} `json:"stats,omitempty"`
	RejectReason string      `json:"rejectReason,omitempty"`
}

type Client struct {
	Conn *websocket.Conn
	Send chan []byte
}

type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[*Client]bool),
	}
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	h.clients[client] = true
	h.mu.Unlock()
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.Send)
	}
	h.mu.Unlock()
}

func (h *Hub) Broadcast(msg WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.Send <- data:
		default:
			go h.Unregister(client)
		}
	}
}

func (h *Hub) BroadcastTemplateUpdate(sourceID uint32, templateID uint16) {
	h.Broadcast(WSMessage{
		Type:       "template_update",
		SourceID:   sourceID,
		TemplateID: templateID,
	})
}

func (h *Hub) BroadcastFlowRecord(sourceID uint32, templateID uint16, record interface{}) {
	h.Broadcast(WSMessage{
		Type:       "flow_record",
		SourceID:   sourceID,
		TemplateID: templateID,
		Record:     record,
	})
}

func (h *Hub) BroadcastStatsUpdate(stats interface{}) {
	h.Broadcast(WSMessage{
		Type:  "stats_update",
		Stats: stats,
	})
}

func (h *Hub) BroadcastTemplateWarning(sourceID uint32, templateID uint16, reason string) {
	h.Broadcast(WSMessage{
		Type:         "template_warning",
		SourceID:     sourceID,
		TemplateID:   templateID,
		RejectReason: reason,
	})
}

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	hub.Register(client)

	go func() {
		defer conn.Close()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
		hub.Unregister(client)
	}()

	go func() {
		defer conn.Close()
		for msg := range client.Send {
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		}
	}()
}
