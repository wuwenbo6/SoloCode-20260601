package main

import "encoding/json"

type MessageType string

const (
	TypeEvent       MessageType = "event"
	TypeStateChange MessageType = "state_change"
	TypeLog         MessageType = "log"
	TypeError       MessageType = "error"
	TypeReset       MessageType = "reset"
)

type WSMessage struct {
	Type    MessageType `json:"type"`
	Payload interface{} `json:"payload"`
}

type EventPayload struct {
	Event string `json:"event"`
}

type StateChangePayload struct {
	From      string `json:"from"`
	To        string `json:"to"`
	Event     string `json:"event"`
	Timestamp int64  `json:"timestamp"`
}

type LogPayload struct {
	Direction   string `json:"direction"`
	MessageType string `json:"messageType"`
	Content     string `json:"content"`
	Timestamp   int64  `json:"timestamp"`
}

type ErrorPayload struct {
	Message string `json:"message"`
}

type ResetPayload struct {
	State string `json:"state"`
}

func MarshalMessage(msg WSMessage) ([]byte, error) {
	return json.Marshal(msg)
}
