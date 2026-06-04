package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/quic-go/webtransport-go"
)

type ReplayEngine struct {
	influx  *InfluxRepo
	session *Session
	payload ReplayPayload
}

func NewReplayEngine(influx *InfluxRepo, session *Session, payload ReplayPayload) *ReplayEngine {
	return &ReplayEngine{
		influx:  influx,
		session: session,
		payload: payload,
	}
}

func (re *ReplayEngine) Run(ctx context.Context) error {
	startTime, err := time.Parse(time.RFC3339, re.payload.StartTime)
	if err != nil {
		startTime, err = time.Parse("2006-01-02T15:04:05", re.payload.StartTime)
		if err != nil {
			return err
		}
	}

	endTime, err := time.Parse(time.RFC3339, re.payload.EndTime)
	if err != nil {
		endTime, err = time.Parse("2006-01-02T15:04:05", re.payload.EndTime)
		if err != nil {
			return err
		}
	}

	speed := re.payload.Speed
	if speed < 1 {
		speed = 1
	}

	chunkSize := 1 * time.Hour
	chunkCount := 0

	for chunkStart := startTime; chunkStart.Before(endTime); chunkStart = chunkStart.Add(chunkSize) {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		chunkEnd := chunkStart.Add(chunkSize)
		if chunkEnd.After(endTime) {
			chunkEnd = endTime
		}

		data, err := re.influx.QueryHistory(chunkStart, chunkEnd, re.payload.SensorIDs)
		if err != nil {
			log.Printf("query chunk error: %v", err)
			continue
		}

		chunkCount++
		log.Printf("replay chunk %d: %d points from %s to %s", chunkCount, len(data),
			chunkStart.Format("15:04:05"), chunkEnd.Format("15:04:05"))

		if err := re.playChunk(ctx, data, speed); err != nil {
			return err
		}
	}

	endMsg := ServerMessage{Type: "replay_end", Payload: nil}
	return re.session.SendMessage(endMsg)
}

func (re *ReplayEngine) playChunk(ctx context.Context, data []SensorData, speed int) error {
	if len(data) == 0 {
		return nil
	}

	interval := 100 * time.Millisecond / time.Duration(speed)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for i, point := range data {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			msg := ServerMessage{Type: "replay_data", Payload: point}
			if err := re.session.SendMessage(msg); err != nil {
				return err
			}
			if i%100 == 0 && speed > 2 {
				time.Sleep(5 * time.Millisecond)
			}
		}
	}

	return nil
}

func HandleWebTransport(sess *webtransport.Session, sm *SessionManager, influx *InfluxRepo, tm *ThresholdManager) {
	session := NewSession(sess)
	sm.Add(session)
	defer func() {
		session.Close()
		sm.Remove(session)
		log.Printf("session closed, active sessions: %d", sm.Count())
	}()

	log.Printf("new WebTransport session, active sessions: %d", sm.Count())

	session.StartHeartbeat()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		<-ctx.Done()
		sess.CloseWithError(0, "session closing")
	}()

	stream, err := sess.AcceptStream(ctx)
	if err != nil {
		log.Printf("failed to accept stream: %v", err)
		return
	}
	defer stream.Close()

	decoder := json.NewDecoder(stream)
	for {
		var msg ClientMessage
		if err := decoder.Decode(&msg); err != nil {
			log.Printf("failed to decode client message: %v", err)
			return
		}

		switch msg.Type {
		case "subscribe":
			var payload SubscribePayload
			if p, err := json.Marshal(msg.Payload); err == nil {
				json.Unmarshal(p, &payload)
				session.Subscribe(payload.SensorIDs)
				log.Printf("session subscribed to %d sensors", len(payload.SensorIDs))
			}

		case "unsubscribe":
			var payload SubscribePayload
			if p, err := json.Marshal(msg.Payload); err == nil {
				json.Unmarshal(p, &payload)
				session.Unsubscribe(payload.SensorIDs)
			}

		case "replay_start":
			var payload ReplayPayload
			if p, err := json.Marshal(msg.Payload); err == nil {
				json.Unmarshal(p, &payload)
				session.StartReplay(influx, payload)
			}

		case "replay_stop":
			session.StopReplay()

		case "set_threshold":
			var payload ThresholdPayload
			if p, err := json.Marshal(msg.Payload); err == nil {
				json.Unmarshal(p, &payload)
				if err := tm.Set(payload); err != nil {
					log.Printf("failed to set threshold: %v", err)
				}
			}

		case "heartbeat_ack":
			var payload map[string]int64
			if p, err := json.Marshal(msg.Payload); err == nil {
				json.Unmarshal(p, &payload)
				if ts, ok := payload["ts"]; ok {
					session.UpdateHeartbeat(ts)
				}
			}

		case "view_state_update":
			var state ViewState
			if p, err := json.Marshal(msg.Payload); err == nil {
				json.Unmarshal(p, &state)
				session.mu.Lock()
				session.ViewState = state
				session.mu.Unlock()

				syncMsg := ViewStateSync{
					State:     state,
					SessionID: session.SessionID,
					Timestamp: time.Now().UnixMilli(),
				}
				sm.BroadcastViewState(session, syncMsg)
			}

		case "ack":
		}
	}
}
