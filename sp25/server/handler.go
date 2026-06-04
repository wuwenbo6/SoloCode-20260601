package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/quic-go/webtransport-go"
)

const (
	heartbeatInterval = 5 * time.Second
	heartbeatTimeout  = 15 * time.Second
)

type Session struct {
	conn            *webtransport.Session
	subscribed      map[int]bool
	cc              *CongestionController
	replay          *ReplayEngine
	mu              sync.RWMutex
	sendMu          sync.Mutex
	lastSendTime    time.Time
	cancelReplay    context.CancelFunc
	lastHeartbeatTs int64
	heartbeatMu     sync.RWMutex
	heartbeatFailed int
	heartbeatCtx    context.Context
	cancelHeartbeat context.CancelFunc
	SessionID       string
	ViewState       ViewState
}

func NewSession(conn *webtransport.Session) *Session {
	ctx, cancel := context.WithCancel(context.Background())
	sessionID := generateSessionID()
	return &Session{
		conn:            conn,
		subscribed:      make(map[int]bool),
		cc:              NewCongestionController(),
		heartbeatCtx:    ctx,
		cancelHeartbeat: cancel,
		SessionID:       sessionID,
		ViewState: ViewState{
			SelectedSensors: []int{},
			ViewMode:        "monitor",
			ShowPrediction:  true,
			UserID:          sessionID,
			UserName:        "用户-" + sessionID[:6],
		},
	}
}

func generateSessionID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return fmt.Sprintf("sess-%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("%x", b)
}

func (s *Session) StartHeartbeat() {
	ticker := time.NewTicker(heartbeatInterval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-s.heartbeatCtx.Done():
				return
			case <-ticker.C:
				now := time.Now().UnixMilli()
				s.heartbeatMu.Lock()
				lastTs := s.lastHeartbeatTs
				s.heartbeatMu.Unlock()

				if lastTs > 0 && (now-lastTs) > heartbeatTimeout.Milliseconds() {
					s.heartbeatMu.Lock()
					s.heartbeatFailed++
					failed := s.heartbeatFailed
					s.heartbeatMu.Unlock()

					if failed >= 3 {
						log.Printf("heartbeat timeout, closing session")
						s.conn.CloseWithError(0, "heartbeat timeout")
						return
					}
				}

				msg := ServerMessage{
					Type:    "heartbeat",
					Payload: HeartbeatPayload{Timestamp: now},
				}
				if err := s.SendMessage(msg); err != nil {
					log.Printf("failed to send heartbeat: %v", err)
				}
			}
		}
	}()
}

func (s *Session) UpdateHeartbeat(ts int64) {
	s.heartbeatMu.Lock()
	defer s.heartbeatMu.Unlock()
	s.lastHeartbeatTs = ts
	s.heartbeatFailed = 0
}

func (s *Session) Subscribe(ids []int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, id := range ids {
		s.subscribed[id] = true
	}
}

func (s *Session) Unsubscribe(ids []int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, id := range ids {
		delete(s.subscribed, id)
	}
}

func (s *Session) IsSubscribed(id int) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.subscribed[id]
}

func (s *Session) HasAnySubscription() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.subscribed) > 0
}

func (s *Session) SendMessage(msg ServerMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	s.sendMu.Lock()
	defer s.sendMu.Unlock()

	stream, err := s.conn.OpenStream()
	if err != nil {
		return err
	}
	defer stream.Close()

	_, err = stream.Write(data)
	if err != nil {
		return err
	}

	s.cc.OnSend(len(data))
	return nil
}

func (s *Session) TrySendSensorData(data SensorData) {
	if !s.IsSubscribed(data.ID) {
		return
	}

	now := time.Now()
	interval := time.Duration(s.cc.CurrentInterval()) * time.Millisecond
	if now.Sub(s.lastSendTime) < interval {
		return
	}

	s.lastSendTime = now
	msg := ServerMessage{Type: "sensor_data", Payload: data}

	if err := s.SendMessage(msg); err != nil {
		log.Printf("failed to send sensor data to session: %v", err)
		return
	}

	newInterval := s.cc.GetInterval()
	if newInterval > 0 {
		congestionMsg := ServerMessage{
			Type:    "congestion",
			Payload: CongestionPayload{IntervalMs: newInterval},
		}
		if err := s.SendMessage(congestionMsg); err != nil {
			log.Printf("failed to send congestion message: %v", err)
		}
	}
}

func (s *Session) StartReplay(influx *InfluxRepo, payload ReplayPayload) {
	s.mu.Lock()
	if s.cancelReplay != nil {
		s.cancelReplay()
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.cancelReplay = cancel
	s.mu.Unlock()

	engine := NewReplayEngine(influx, s, payload)
	s.replay = engine

	go func() {
		if err := engine.Run(ctx); err != nil {
			log.Printf("replay error: %v", err)
		}
	}()
}

func (s *Session) StopReplay() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancelReplay != nil {
		s.cancelReplay()
		s.cancelReplay = nil
	}
}

func (s *Session) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cancelHeartbeat()
	if s.cancelReplay != nil {
		s.cancelReplay()
	}
}

type SessionManager struct {
	mu       sync.RWMutex
	sessions map[*Session]bool
}

func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[*Session]bool),
	}
}

func (sm *SessionManager) Add(s *Session) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.sessions[s] = true
}

func (sm *SessionManager) Remove(s *Session) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.sessions, s)
}

func (sm *SessionManager) BroadcastData(data SensorData) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	for s := range sm.sessions {
		s.TrySendSensorData(data)
	}
}

func (sm *SessionManager) BroadcastAlert(alert AlertPayload) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	for s := range sm.sessions {
		msg := ServerMessage{Type: "alert", Payload: alert}
		if err := s.SendMessage(msg); err != nil {
			log.Printf("failed to broadcast alert: %v", err)
		}
	}
}

func (sm *SessionManager) Count() int {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return len(sm.sessions)
}

func (sm *SessionManager) BroadcastViewState(sender *Session, state ViewStateSync) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	for s := range sm.sessions {
		if s.SessionID == sender.SessionID {
			continue
		}
		msg := ServerMessage{Type: "view_state_sync", Payload: state}
		if err := s.SendMessage(msg); err != nil {
			log.Printf("failed to send view state sync: %v", err)
		}
	}
}

func (sm *SessionManager) GetAllViewStates() []ViewStateSync {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	var states []ViewStateSync
	for s := range sm.sessions {
		states = append(states, ViewStateSync{
			State:     s.ViewState,
			SessionID: s.SessionID,
			Timestamp: time.Now().UnixMilli(),
		})
	}
	return states
}
