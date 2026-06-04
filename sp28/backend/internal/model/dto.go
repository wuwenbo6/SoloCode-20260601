package model

import "time"

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateAccessRequest struct {
	ServerID uint   `json:"server_id" binding:"required"`
	Reason   string `json:"reason" binding:"required"`
	Duration string `json:"duration" binding:"required"`
}

type ReviewAccessRequest struct {
	Action string `json:"action" binding:"required"`
}

type ConnectSSHRequest struct {
	ServerID uint `json:"server_id"`
}

type WSMessage struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

const (
	MsgTypeStdout = "stdout"
	MsgTypeStdin  = "stdin"
	MsgTypeResize = "resize"
	MsgTypeClose  = "close"
	MsgTypeError  = "error"
	MsgTypePing   = "ping"
	MsgTypePong   = "pong"
)

type PlaybackFrame struct {
	Header  []byte  `json:"header"`
	Content []byte  `json:"content"`
	Delay   float64 `json:"delay"`
}

type RecordingInfo struct {
	ID            uint       `json:"id"`
	SessionID     uint       `json:"session_id"`
	Username      string     `json:"username"`
	ServerName    string     `json:"server_name"`
	ServerHost    string     `json:"server_host"`
	StartTime     time.Time  `json:"start_time"`
	EndTime       *time.Time `json:"end_time,omitempty"`
	Duration      float64    `json:"duration"`
	RecordingPath string     `json:"recording_path"`
	FileSize      int64      `json:"file_size"`
}
