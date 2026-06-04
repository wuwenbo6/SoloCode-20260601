package handler

import (
	"encoding/json"
	"sync"
	"sync/atomic"
	"time"

	"config-server/internal/model"

	"github.com/gorilla/websocket"
)

type WSClient struct {
	id     uint64
	hub    *WSHub
	conn   *websocket.Conn
	send   chan []byte
	keys   map[string]struct{}
	done   chan struct{}
	closed atomic.Bool
}

type WSHub struct {
	clients    map[uint64]*WSClient
	register   chan *WSClient
	unregister chan *WSClient
	broadcast  chan *BroadcastMessage
	mu         sync.RWMutex
	nextID     atomic.Uint64
}

type BroadcastMessage struct {
	Key   string
	Event *model.WatchEvent
}

func NewWSHub() *WSHub {
	return &WSHub{
		clients:    make(map[uint64]*WSClient),
		register:   make(chan *WSClient),
		unregister: make(chan *WSClient),
		broadcast:  make(chan *BroadcastMessage, 256),
	}
}

func (h *WSHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.id] = client
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.id]; ok {
				delete(h.clients, client.id)
				close(client.send)
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			data, err := json.Marshal(msg.Event)
			if err != nil {
				continue
			}
			h.mu.RLock()
			for _, client := range h.clients {
				if _, subscribed := client.keys[msg.Key]; subscribed {
					select {
					case client.send <- data:
					default:
						go h.forceUnregister(client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *WSHub) forceUnregister(client *WSClient) {
	if client.closed.CompareAndSwap(false, true) {
		h.unregister <- client
	}
}

func (h *WSHub) Register(client *WSClient) {
	h.register <- client
}

func (h *WSHub) Unregister(client *WSClient) {
	if client.closed.CompareAndSwap(false, true) {
		h.unregister <- client
	}
}

func (h *WSHub) Broadcast(key string, event *model.WatchEvent) {
	h.broadcast <- &BroadcastMessage{Key: key, Event: event}
}

func (h *WSHub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

func NewWSClient(hub *WSHub, conn *websocket.Conn) *WSClient {
	id := hub.nextID.Add(1)
	return &WSClient{
		id:   id,
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 64),
		keys: make(map[string]struct{}),
		done: make(chan struct{}),
	}
}

func (c *WSClient) Subscribe(key string) {
	c.keys[key] = struct{}{}
}

func (c *WSClient) Unsubscribe(key string) {
	delete(c.keys, key)
}

func (c *WSClient) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}

		case <-c.done:
			return
		}
	}
}

func (c *WSClient) Close() {
	close(c.done)
}
