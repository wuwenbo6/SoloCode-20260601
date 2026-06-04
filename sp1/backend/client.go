package main

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("read error: %v", err)
			}
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("parse error: %v", err)
			continue
		}

		c.handleMessage(msg)
	}
}

func (c *Client) handleMessage(msg WSMessage) {
	switch msg.Type {
	case TypeEvent:
		payload, ok := msg.Payload.(map[string]interface{})
		if !ok {
			return
		}
		eventName, _ := payload["event"].(string)
		if eventName == "" {
			return
		}

		if eventName == "reset" {
			c.hub.transaction.Reset()
			resetMsg := WSMessage{
				Type: TypeReset,
				Payload: ResetPayload{
					State: string(StateIdle),
				},
			}
			data, _ := MarshalMessage(resetMsg)
			c.hub.broadcast <- data
			return
		}

		event := SIPEvent(eventName)
		from, to, ok := c.hub.transaction.HandleEvent(event)
		if !ok {
			errMsg := WSMessage{
				Type: TypeError,
				Payload: ErrorPayload{
					Message: "Invalid event " + eventName + " in state " + string(from),
				},
			}
			data, _ := MarshalMessage(errMsg)
			c.send <- data
			return
		}

		logMsg := WSMessage{
			Type: TypeLog,
			Payload: LogPayload{
				Direction:   EventDirection(event),
				MessageType: EventLabel(event),
				Content:     c.hub.transaction.SIPMessageForEvent(event),
				Timestamp:   time.Now().UnixMilli(),
			},
		}
		logData, _ := MarshalMessage(logMsg)
		c.hub.broadcast <- logData

		stateMsg := WSMessage{
			Type: TypeStateChange,
			Payload: StateChangePayload{
				From:      string(from),
				To:        string(to),
				Event:     string(event),
				Timestamp: time.Now().UnixMilli(),
			},
		}
		stateData, _ := MarshalMessage(stateMsg)
		c.hub.broadcast <- stateData
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
