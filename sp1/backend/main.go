package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func serveWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
	}
	hub.register <- client

	go client.writePump()
	go client.readPump()
}

func serveExportLogs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	logs := hub.transaction.GetStateLog()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=sip_transaction_log.json")
	json.NewEncoder(w).Encode(logs)
}

func main() {
	hub := NewHub()
	hub.transaction = NewTransaction(
		func(from SIPState, to SIPState, event SIPEvent, timestamp int64) {
			log.Printf("State change: %s -> %s (event: %s)", from, to, event)
		},
		func(event SIPEvent, message string, timestamp int64) {
			log.Printf("Auto message: %s", EventLabel(event))
			logMsg := WSMessage{
				Type: TypeLog,
				Payload: LogPayload{
					Direction:   EventDirection(event),
					MessageType: EventLabel(event),
					Content:     message,
					Timestamp:   timestamp,
				},
			}
			logData, _ := MarshalMessage(logMsg)
			hub.broadcast <- logData
		},
	)
	go hub.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWS(hub, w, r)
	})

	http.HandleFunc("/api/logs", func(w http.ResponseWriter, r *http.Request) {
		serveExportLogs(hub, w, r)
	})

	fs := http.FileServer(http.Dir("./frontend_dist"))
	http.Handle("/", fs)

	addr := ":8080"
	fmt.Printf("SIP Transaction Simulator running on http://localhost%s\n", addr)
	fmt.Printf("WebSocket endpoint: ws://localhost%s/ws\n", addr)
	fmt.Printf("Log export: http://localhost%s/api/logs\n", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
