package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/quic-go/webtransport-go"
)

type SessionType string

const (
	SessionTypeSender   SessionType = "sender"
	SessionTypeReceiver SessionType = "receiver"
)

type MessageType string

const (
	MessageTypeVideo       MessageType = "video"
	MessageTypeMouseEvent  MessageType = "mouse"
	MessageTypeKeyboardEvent MessageType = "keyboard"
	MessageTypeCursor      MessageType = "cursor"
	MessageTypeControl     MessageType = "control"
	MessageTypeClipboard   MessageType = "clipboard"
	MessageTypeWhiteboard  MessageType = "whiteboard"
)

type Message struct {
	Type    MessageType `json:"type"`
	Payload interface{} `json:"payload"`
}

type MouseEvent struct {
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Button   int     `json:"button"`
	Buttons  int     `json:"buttons"`
	MovementX int    `json:"movementX"`
	MovementY int    `json:"movementY"`
	DeltaX   float64 `json:"deltaX"`
	DeltaY   float64 `json:"deltaY"`
	Event    string  `json:"event"`
}

type KeyboardEvent struct {
	Key      string `json:"key"`
	Code     string `json:"code"`
	ShiftKey bool   `json:"shiftKey"`
	CtrlKey  bool   `json:"ctrlKey"`
	AltKey   bool   `json:"altKey"`
	MetaKey  bool   `json:"metaKey"`
	Repeat   bool   `json:"repeat"`
	Event    string `json:"event"`
}

type CursorData struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Visible bool    `json:"visible"`
}

type Server struct {
	wtServer  *webtransport.Server
	sender    *webtransport.Session
	receiver  *webtransport.Session
	mu        sync.RWMutex
	eventChan chan []byte
}

func NewServer() *Server {
	return &Server{
		eventChan: make(chan []byte, 100),
	}
}

func (s *Server) handleSession(session *webtransport.Session, sessionType SessionType) {
	s.mu.Lock()
	if sessionType == SessionTypeSender {
		if s.sender != nil {
			s.sender.CloseWithError(0, "new sender connected")
		}
		s.sender = session
		log.Println("Sender connected")
	} else {
		if s.receiver != nil {
			s.receiver.CloseWithError(0, "new receiver connected")
		}
		s.receiver = session
		log.Println("Receiver connected")
	}
	s.mu.Unlock()

	go s.handleBidirectionalStreams(session, sessionType)
	go s.handleUnidirectionalStreams(session, sessionType)

	<-session.Context().Done()

	s.mu.Lock()
	if sessionType == SessionTypeSender && s.sender == session {
		s.sender = nil
		log.Println("Sender disconnected")
	} else if sessionType == SessionTypeReceiver && s.receiver == session {
		s.receiver = nil
		log.Println("Receiver disconnected")
	}
	s.mu.Unlock()
}

func (s *Server) handleBidirectionalStreams(session *webtransport.Session, sessionType SessionType) {
	for {
		stream, err := session.AcceptStream(context.Background())
		if err != nil {
			log.Printf("Failed to accept stream for %s: %v", sessionType, err)
			return
		}
		go s.handleStream(stream, sessionType)
	}
}

func (s *Server) handleUnidirectionalStreams(session *webtransport.Session, sessionType SessionType) {
	for {
		stream, err := session.AcceptUniStream(context.Background())
		if err != nil {
			log.Printf("Failed to accept unistream for %s: %v", sessionType, err)
			return
		}
		go s.handleUniStream(stream, sessionType)
	}
}

func (s *Server) handleStream(stream webtransport.Stream, sessionType SessionType) {
	defer stream.Close()

	buf := make([]byte, 4096)
	for {
		n, err := stream.Read(buf)
		if err != nil {
			return
		}

		data := buf[:n]
		
		s.mu.RLock()
		var target *webtransport.Session
		if sessionType == SessionTypeSender {
			target = s.receiver
		} else {
			target = s.sender
		}
		s.mu.RUnlock()

		if target != nil {
			go s.sendToTarget(target, data, false)
		}
	}
}

func (s *Server) handleUniStream(stream webtransport.ReceiveStream, sessionType SessionType) {
	buf := make([]byte, 1<<16)
	for {
		n, err := stream.Read(buf)
		if err != nil {
			return
		}

		data := buf[:n]

		s.mu.RLock()
		var target *webtransport.Session
		if sessionType == SessionTypeSender {
			target = s.receiver
		} else {
			target = s.sender
		}
		s.mu.RUnlock()

		if target != nil {
			go s.sendToTarget(target, data, true)
		}
	}
}

func (s *Server) sendToTarget(target *webtransport.Session, data []byte, unidirectional bool) {
	if unidirectional {
		stream, err := target.OpenUniStream()
		if err != nil {
			log.Printf("Failed to open unistream: %v", err)
			return
		}
		defer stream.Close()
		stream.Write(data)
	} else {
		stream, err := target.OpenStream()
		if err != nil {
			log.Printf("Failed to open stream: %v", err)
			return
		}
		defer stream.Close()
		stream.Write(data)
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	sessionType := SessionType(r.URL.Query().Get("type"))
	if sessionType != SessionTypeSender && sessionType != SessionTypeReceiver {
		http.Error(w, "invalid session type", http.StatusBadRequest)
		return
	}

	session, err := s.wtServer.Upgrade(w, r)
	if err != nil {
		log.Printf("Upgrade failed: %v", err)
		return
	}

	s.handleSession(session, sessionType)
}

func main() {
	cert, err := tls.LoadX509KeyPair("cert.pem", "key.pem")
	if err != nil {
		log.Fatalf("Failed to load certificate: %v", err)
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		NextProtos:   []string{"webtransport"},
	}

	wtServer := &webtransport.Server{
		TLSConfig: tlsConfig,
		QuicConfig: &webtransport.QuicConfig{
			MaxIncomingStreams: 100,
		},
	}

	server := NewServer()
	server.wtServer = wtServer

	http.HandleFunc("/ws", server.ServeHTTP)

	addr := ":4433"
	log.Printf("Server starting on %s", addr)
	if err := wtServer.ListenAndServe(addr); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}
