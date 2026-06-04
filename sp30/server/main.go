package main

import (
	"context"
	"crypto/tls"
	"encoding/binary"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
)

type MessageType string

const (
	MsgJoinRoom        MessageType = "join_room"
	MsgLeaveRoom       MessageType = "leave_room"
	MsgRoomList        MessageType = "room_list"
	MsgRoomInfo        MessageType = "room_info"
	MsgStartPublish    MessageType = "start_publish"
	MsgStopPublish     MessageType = "stop_publish"
	MsgSubscribe       MessageType = "subscribe"
	MsgUnsubscribe     MessageType = "unsubscribe"
	MsgStats           MessageType = "stats"
	MsgBitrateChange   MessageType = "bitrate_change"
	MsgPong            MessageType = "pong"
	MsgRequestKeyframe MessageType = "request_keyframe"
	MsgFrameAck        MessageType = "frame_ack"
	MsgPublisherLeft   MessageType = "publisher_left"
	MsgChatMessage     MessageType = "chat_message"
	MsgStartRecording  MessageType = "start_recording"
	MsgStopRecording   MessageType = "stop_recording"
	MsgRecordingStatus MessageType = "recording_status"
	MsgTextOverlay     MessageType = "text_overlay"
)

type Message struct {
	Type    MessageType     `json:"type"`
	RoomID  string          `json:"room_id,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type Client struct {
	id          string
	name        string
	session     *webtransport.Session
	room        *Room
	isPublisher bool
	publisherID string
	recorder    *MP4Recorder
}

type Room struct {
	id         string
	name       string
	clients    map[string]*Client
	publishers map[string]*Client
	mu         sync.RWMutex
}

type Server struct {
	wtServer *webtransport.Server
	rooms    map[string]*Room
	mu       sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		rooms: make(map[string]*Room),
	}
}

func (s *Server) getOrCreateRoom(roomID, roomName string) *Room {
	s.mu.Lock()
	defer s.mu.Unlock()

	if room, ok := s.rooms[roomID]; ok {
		return room
	}

	room := &Room{
		id:         roomID,
		name:       roomName,
		clients:    make(map[string]*Client),
		publishers: make(map[string]*Client),
	}
	s.rooms[roomID] = room
	log.Printf("Room created: %s (%s)", roomID, roomName)
	return room
}

func (s *Server) removeRoomIfEmpty(roomID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if room, ok := s.rooms[roomID]; ok {
		room.mu.RLock()
		clientCount := len(room.clients)
		room.mu.RUnlock()

		if clientCount == 0 {
			delete(s.rooms, roomID)
			log.Printf("Room removed: %s", roomID)
		}
	}
}

func (s *Server) getRoomList() []RoomInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rooms := make([]RoomInfo, 0, len(s.rooms))
	for _, room := range s.rooms {
		room.mu.RLock()
		rooms = append(rooms, RoomInfo{
			ID:           room.id,
			Name:         room.name,
			ClientCount:  len(room.clients),
			PublisherIDs: getPublisherIDs(room.publishers),
		})
		room.mu.RUnlock()
	}
	return rooms
}

func getPublisherIDs(publishers map[string]*Client) []string {
	ids := make([]string, 0, len(publishers))
	for id := range publishers {
		ids = append(ids, id)
	}
	return ids
}

type RoomInfo struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	ClientCount  int      `json:"client_count"`
	PublisherIDs []string `json:"publisher_ids"`
}

type JoinRoomPayload struct {
	RoomID   string `json:"room_id"`
	RoomName string `json:"room_name"`
	ClientID string `json:"client_id"`
}

type SubscribePayload struct {
	PublisherID string `json:"publisher_id"`
}

type RequestKeyframePayload struct {
	PublisherID  string `json:"publisher_id"`
	SubscriberID string `json:"subscriber_id"`
}

type FrameAckPayload struct {
	FrameID     uint32 `json:"frame_id"`
	ChunkIndex  uint16 `json:"chunk_index"`
	TotalChunks uint16 `json:"total_chunks"`
	Received    bool   `json:"received"`
}

type ChatMessagePayload struct {
	ClientID   string `json:"client_id"`
	ClientName string `json:"client_name"`
	Message    string `json:"message"`
	Timestamp  int64  `json:"timestamp"`
}

type StartRecordingPayload struct {
	RoomID      string `json:"room_id"`
	PublisherID string `json:"publisher_id"`
}

type StopRecordingPayload struct {
	RoomID      string `json:"room_id"`
	PublisherID string `json:"publisher_id"`
}

type RecordingStatusPayload struct {
	RoomID      string `json:"room_id"`
	PublisherID string `json:"publisher_id"`
	IsRecording bool   `json:"is_recording"`
	Filename    string `json:"filename,omitempty"`
	StartTime   int64  `json:"start_time,omitempty"`
	Duration    int64  `json:"duration,omitempty"`
}

type TextOverlayPayload struct {
	PublisherID     string `json:"publisher_id"`
	Text            string `json:"text"`
	Position        string `json:"position"`
	FontSize        int    `json:"font_size"`
	Color           string `json:"color"`
	BackgroundColor string `json:"background_color"`
	Show            bool   `json:"show"`
}

type StatsPayload struct {
	RTT       float64 `json:"rtt"`
	LossRate  float64 `json:"loss_rate"`
	Bitrate   float64 `json:"bitrate"`
	Framerate float64 `json:"framerate"`
	Timestamp int64   `json:"timestamp"`
}

func (s *Server) handleSession(ctx context.Context, session *webtransport.Session) {
	clientID := generateClientID()
	client := &Client{
		id:      clientID,
		session: session,
	}

	log.Printf("Client connected: %s from %s", clientID, session.RemoteAddr())

	defer func() {
		if client.room != nil {
			s.leaveRoom(client)
		}
		log.Printf("Client disconnected: %s", clientID)
		session.CloseWithError(0, "session closed")
	}()

	go s.handleControlStreams(ctx, client)

	for {
		stream, err := session.AcceptStream(ctx)
		if err != nil {
			log.Printf("Error accepting stream for client %s: %v", clientID, err)
			return
		}

		go s.handleStream(ctx, client, stream)
	}
}

func (s *Server) handleControlStreams(ctx context.Context, client *Client) {
	for {
		uniStream, err := client.session.AcceptUniStream(ctx)
		if err != nil {
			log.Printf("Error accepting uni stream: %v", err)
			return
		}

		buf := make([]byte, 1024)
		n, err := uniStream.Read(buf)
		if err != nil {
			continue
		}

		var msg Message
		if err := json.Unmarshal(buf[:n], &msg); err != nil {
			log.Printf("Error parsing message: %v", err)
			continue
		}

		s.handleControlMessage(ctx, client, &msg)
	}
}

func (s *Server) handleControlMessage(ctx context.Context, client *Client, msg *Message) {
	switch msg.Type {
	case MsgJoinRoom:
		s.handleJoinRoom(ctx, client, msg)
	case MsgLeaveRoom:
		s.handleLeaveRoom(ctx, client, msg)
	case MsgRoomList:
		s.handleRoomList(ctx, client)
	case MsgStartPublish:
		s.handleStartPublish(ctx, client)
	case MsgStopPublish:
		s.handleStopPublish(ctx, client)
	case MsgSubscribe:
		s.handleSubscribe(ctx, client, msg)
	case MsgUnsubscribe:
		s.handleUnsubscribe(ctx, client, msg)
	case MsgStats:
		s.handleStats(ctx, client, msg)
	case MsgPong:
	case MsgBitrateChange:
		s.handleBitrateChange(ctx, client, msg)
	case MsgRequestKeyframe:
		s.handleRequestKeyframe(ctx, client, msg)
	case MsgFrameAck:
	case MsgChatMessage:
		s.handleChatMessage(ctx, client, msg)
	case MsgStartRecording:
		s.handleStartRecording(ctx, client, msg)
	case MsgStopRecording:
		s.handleStopRecording(ctx, client, msg)
	case MsgTextOverlay:
		s.handleTextOverlay(ctx, client, msg)
	case "publisher_left":
	}
}

func (s *Server) handleJoinRoom(ctx context.Context, client *Client, msg *Message) {
	var payload JoinRoomPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		log.Printf("Error parsing join room payload: %v", err)
		return
	}

	if client.room != nil {
		s.leaveRoom(client)
	}

	room := s.getOrCreateRoom(payload.RoomID, payload.RoomName)
	client.room = room

	room.mu.Lock()
	room.clients[client.id] = client
	room.mu.Unlock()

	log.Printf("Client %s joined room %s", client.id, room.id)

	info := RoomInfo{
		ID:           room.id,
		Name:         room.name,
		ClientCount:  len(room.clients),
		PublisherIDs: getPublisherIDs(room.publishers),
	}
	s.sendControlMessage(client, MsgRoomInfo, info)
	s.broadcastRoomList(room.id)
}

func (s *Server) handleLeaveRoom(ctx context.Context, client *Client, msg *Message) {
	if client.room != nil {
		roomID := client.room.id
		s.leaveRoom(client)
		s.removeRoomIfEmpty(roomID)
	}
}

func (s *Server) leaveRoom(client *Client) {
	if client.room == nil {
		return
	}

	room := client.room
	room.mu.Lock()
	delete(room.clients, client.id)
	if client.isPublisher {
		delete(room.publishers, client.id)
		s.notifySubscribersPublisherLeft(room, client.id)
	}
	room.mu.Unlock()

	log.Printf("Client %s left room %s", client.id, room.id)
	client.room = nil
	client.isPublisher = false

	s.broadcastRoomList(room.id)
}

func (s *Server) notifySubscribersPublisherLeft(room *Room, publisherID string) {
	room.mu.RLock()
	defer room.mu.RUnlock()

	msg := struct {
		PublisherID string `json:"publisher_id"`
	}{PublisherID: publisherID}

	msgBytes, _ := json.Marshal(Message{
		Type:    "publisher_left",
		Payload: json.RawMessage(mustMarshal(msg)),
	})

	for _, c := range room.clients {
		if c.id != publisherID {
			if stream, err := c.session.OpenUniStream(); err == nil {
				stream.Write(msgBytes)
				stream.Close()
			}
		}
	}
}

func (s *Server) handleRoomList(ctx context.Context, client *Client) {
	rooms := s.getRoomList()
	s.sendControlMessage(client, MsgRoomList, rooms)
}

func (s *Server) broadcastRoomList(roomID string) {
	s.mu.RLock()
	room, ok := s.rooms[roomID]
	s.mu.RUnlock()
	if !ok {
		return
	}

	room.mu.RLock()
	defer room.mu.RUnlock()

	info := RoomInfo{
		ID:           room.id,
		Name:         room.name,
		ClientCount:  len(room.clients),
		PublisherIDs: getPublisherIDs(room.publishers),
	}

	for _, c := range room.clients {
		s.sendControlMessage(c, MsgRoomInfo, info)
	}
}

func (s *Server) handleStartPublish(ctx context.Context, client *Client) {
	if client.room == nil {
		return
	}

	client.room.mu.Lock()
	client.isPublisher = true
	client.room.publishers[client.id] = client
	client.room.mu.Unlock()

	client.publisherID = client.id

	log.Printf("Client %s started publishing in room %s", client.id, client.room.id)
	s.broadcastRoomList(client.room.id)
}

func (s *Server) handleStopPublish(ctx context.Context, client *Client) {
	if client.room == nil || !client.isPublisher {
		return
	}

	if client.recorder != nil && client.recorder.IsRecording() {
		client.recorder.Stop()
		client.recorder = nil
	}

	client.room.mu.Lock()
	client.isPublisher = false
	delete(client.room.publishers, client.id)
	client.room.mu.Unlock()

	s.notifySubscribersPublisherLeft(client.room, client.id)
	s.broadcastRoomList(client.room.id)

	log.Printf("Client %s stopped publishing in room %s", client.id, client.room.id)
}

func (s *Server) handleSubscribe(ctx context.Context, client *Client, msg *Message) {
	if client.room == nil {
		return
	}

	var payload SubscribePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		log.Printf("Error parsing subscribe payload: %v", err)
		return
	}

	log.Printf("Client %s subscribed to %s in room %s", client.id, payload.PublisherID, client.room.id)
}

func (s *Server) handleUnsubscribe(ctx context.Context, client *Client, msg *Message) {
	var payload SubscribePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	log.Printf("Client %s unsubscribed from %s", client.id, payload.PublisherID)
}

func (s *Server) handleStats(ctx context.Context, client *Client, msg *Message) {
	if client.room == nil {
		return
	}

	client.room.mu.RLock()
	defer client.room.mu.RUnlock()

	msgBytes, _ := json.Marshal(Message{
		Type:    MsgStats,
		Payload: msg.Payload,
	})

	for _, c := range client.room.clients {
		if c.id != client.id {
			if stream, err := c.session.OpenUniStream(); err == nil {
				stream.Write(msgBytes)
				stream.Close()
			}
		}
	}
}

func (s *Server) handleBitrateChange(ctx context.Context, client *Client, msg *Message) {
	log.Printf("Client %s bitrate change: %s", client.id, string(msg.Payload))
}

func (s *Server) handleRequestKeyframe(ctx context.Context, client *Client, msg *Message) {
	if client.room == nil {
		return
	}

	var payload RequestKeyframePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		log.Printf("Error parsing request_keyframe payload: %v", err)
		return
	}

	client.room.mu.RLock()
	publisher, ok := client.room.publishers[payload.PublisherID]
	client.room.mu.RUnlock()

	if !ok {
		log.Printf("Publisher %s not found in room %s", payload.PublisherID, client.room.id)
		return
	}

	log.Printf("Forwarding key frame request from %s to publisher %s in room %s",
		payload.SubscriberID, payload.PublisherID, client.room.id)

	s.sendControlMessage(publisher, MsgRequestKeyframe, payload)
}

func (s *Server) handleChatMessage(ctx context.Context, client *Client, msg *Message) {
	if client.room == nil {
		return
	}

	var payload ChatMessagePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		log.Printf("Error parsing chat_message payload: %v", err)
		return
	}

	payload.ClientID = client.id
	if payload.Timestamp == 0 {
		payload.Timestamp = time.Now().UnixMilli()
	}

	log.Printf("Chat message from %s (%s) in room %s: %s",
		client.name, client.id, client.room.id, payload.Message)

	msgBytes, _ := json.Marshal(Message{
		Type:    MsgChatMessage,
		Payload: json.RawMessage(mustMarshal(payload)),
	})

	client.room.mu.RLock()
	defer client.room.mu.RUnlock()

	for _, c := range client.room.clients {
		if stream, err := c.session.OpenUniStream(); err == nil {
			stream.Write(msgBytes)
			stream.Close()
		}
	}
}

func (s *Server) handleStartRecording(ctx context.Context, client *Client, msg *Message) {
	if client.room == nil {
		return
	}

	var payload StartRecordingPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		log.Printf("Error parsing start_recording payload: %v", err)
		return
	}

	client.room.mu.RLock()
	publisher, ok := client.room.publishers[payload.PublisherID]
	client.room.mu.RUnlock()

	if !ok {
		log.Printf("Publisher %s not found in room %s", payload.PublisherID, client.room.id)
		return
	}

	if publisher.recorder != nil && publisher.recorder.IsRecording() {
		log.Printf("Publisher %s is already recording", payload.PublisherID)
		return
	}

	if err := os.MkdirAll("recordings", 0755); err != nil {
		log.Printf("Error creating recordings directory: %v", err)
		return
	}

	filename := GenerateMP4Filename(client.room.id, payload.PublisherID)
	recorder, err := NewMP4Recorder(filename, 1280, 720)
	if err != nil {
		log.Printf("Error creating MP4 recorder: %v", err)
		return
	}

	publisher.recorder = recorder

	log.Printf("Recording started for publisher %s in room %s: %s",
		payload.PublisherID, client.room.id, filename)

	status := RecordingStatusPayload{
		RoomID:      client.room.id,
		PublisherID: payload.PublisherID,
		IsRecording: true,
		Filename:    filename,
		StartTime:   time.Now().UnixMilli(),
	}

	s.broadcastToRoom(client.room, MsgRecordingStatus, status)
}

func (s *Server) handleStopRecording(ctx context.Context, client *Client, msg *Message) {
	if client.room == nil {
		return
	}

	var payload StopRecordingPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		log.Printf("Error parsing stop_recording payload: %v", err)
		return
	}

	client.room.mu.RLock()
	publisher, ok := client.room.publishers[payload.PublisherID]
	client.room.mu.RUnlock()

	if !ok {
		log.Printf("Publisher %s not found in room %s", payload.PublisherID, client.room.id)
		return
	}

	if publisher.recorder == nil || !publisher.recorder.IsRecording() {
		log.Printf("Publisher %s is not recording", payload.PublisherID)
		return
	}

	publisher.recorder.Stop()

	log.Printf("Recording stopped for publisher %s in room %s",
		payload.PublisherID, client.room.id)

	status := RecordingStatusPayload{
		RoomID:      client.room.id,
		PublisherID: payload.PublisherID,
		IsRecording: false,
		Filename:    publisher.recorder.GetFilename(),
		Duration:    int64(publisher.recorder.GetDuration() * 1000),
	}

	publisher.recorder = nil

	s.broadcastToRoom(client.room, MsgRecordingStatus, status)
}

func (s *Server) handleTextOverlay(ctx context.Context, client *Client, msg *Message) {
	if client.room == nil {
		return
	}

	var payload TextOverlayPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		log.Printf("Error parsing text_overlay payload: %v", err)
		return
	}

	payload.PublisherID = client.id

	log.Printf("Text overlay from publisher %s in room %s: show=%v, text=%s",
		client.id, client.room.id, payload.Show, payload.Text)

	client.room.mu.RLock()
	defer client.room.mu.RUnlock()

	for _, c := range client.room.clients {
		if c.id != client.id {
			s.sendControlMessage(c, MsgTextOverlay, payload)
		}
	}
}

func (s *Server) broadcastToRoom(room *Room, msgType MessageType, payload interface{}) {
	msgBytes, _ := json.Marshal(Message{
		Type:    msgType,
		Payload: json.RawMessage(mustMarshal(payload)),
	})

	room.mu.RLock()
	defer room.mu.RUnlock()

	for _, c := range room.clients {
		if stream, err := c.session.OpenUniStream(); err == nil {
			stream.Write(msgBytes)
			stream.Close()
		}
	}
}

func (s *Server) handleStream(ctx context.Context, client *Client, stream webtransport.Stream) {
	if client.room == nil {
		return
	}

	publisherID := client.id
	roomID := client.room.id

	log.Printf("Stream started from publisher %s in room %s, stream ID: %d", publisherID, roomID, stream.StreamID())

	defer func() {
		stream.CancelRead(0)
		stream.Close()
		log.Printf("Stream ended from publisher %s in room %s", publisherID, roomID)

		if client.recorder != nil && client.recorder.IsRecording() {
			client.recorder.Stop()
			client.recorder = nil
		}
	}()

	type FrameBuffer struct {
		chunks     map[uint16][]byte
		total      uint16
		received   uint16
		frameType  uint8
		timestamp  uint32
		createTime time.Time
	}

	frameBuffers := make(map[uint32]*FrameBuffer)
	buf := make([]byte, 65536)

	for {
		n, err := stream.Read(buf)
		if err != nil {
			return
		}

		if n < 13 {
			continue
		}

		frameType := buf[0]
		timestamp := binary.BigEndian.Uint32(buf[1:5])
		frameID := binary.BigEndian.Uint32(buf[5:9])
		chunkIndex := binary.BigEndian.Uint16(buf[9:11])
		totalChunks := binary.BigEndian.Uint16(buf[11:13])
		data := make([]byte, n-13)
		copy(data, buf[13:n])

		if totalChunks == 1 {
			if client.recorder != nil && client.recorder.IsRecording() {
				isKeyFrame := (frameType == 1)
				client.recorder.WriteFrame(data, uint64(timestamp), isKeyFrame)
			}
		} else {
			fb, exists := frameBuffers[frameID]
			if !exists {
				fb = &FrameBuffer{
					chunks:     make(map[uint16][]byte),
					total:      totalChunks,
					frameType:  frameType,
					timestamp:  timestamp,
					createTime: time.Now(),
				}
				frameBuffers[frameID] = fb
			}

			if _, exists := fb.chunks[chunkIndex]; !exists {
				fb.chunks[chunkIndex] = data
				fb.received++

				if fb.received == fb.total {
					frameData := make([]byte, 0)
					for i := uint16(0); i < fb.total; i++ {
						frameData = append(frameData, fb.chunks[i]...)
					}

					if client.recorder != nil && client.recorder.IsRecording() {
						isKeyFrame := (fb.frameType == 1)
						client.recorder.WriteFrame(frameData, uint64(fb.timestamp), isKeyFrame)
					}

					delete(frameBuffers, frameID)
				}
			}

			for fid, buffer := range frameBuffers {
				if time.Since(buffer.createTime) > 3*time.Second {
					delete(frameBuffers, fid)
				}
			}
		}

		header := buf[:13]
		payload := buf[13:n]

		client.room.mu.RLock()
		subscribers := make([]*Client, 0, len(client.room.clients))
		for _, c := range client.room.clients {
			if c.id != client.id {
				subscribers = append(subscribers, c)
			}
		}
		client.room.mu.RUnlock()

		for _, sub := range subscribers {
			go func(sub *Client) {
				if outStream, err := sub.session.OpenUniStream(); err == nil {
					outStream.Write(header)
					outStream.Write(payload)
					outStream.Close()
				}
			}(sub)
		}
	}
}

func (s *Server) sendControlMessage(client *Client, msgType MessageType, payload interface{}) {
	msg := Message{
		Type:    msgType,
		Payload: json.RawMessage(mustMarshal(payload)),
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	stream, err := client.session.OpenUniStream()
	if err != nil {
		log.Printf("Error opening uni stream: %v", err)
		return
	}
	defer stream.Close()

	_, err = stream.Write(msgBytes)
	if err != nil {
		log.Printf("Error writing message: %v", err)
	}
}

func mustMarshal(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

func generateClientID() string {
	return "client_" + time.Now().Format("20060102150405") + "_" + randomString(8)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(1 * time.Nanosecond)
	}
	return string(b)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	log.Printf("Incoming WebTransport upgrade request from %s", r.RemoteAddr)

	session, err := s.wtServer.Upgrade(w, r)
	if err != nil {
		log.Printf("Upgrade failed: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("WebTransport session established with %s", r.RemoteAddr)
	s.handleSession(r.Context(), session)
}

func main() {
	s := NewServer()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, sec-webtransport-http3-draft02")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		s.ServeHTTP(w, r)
	})

	s.wtServer = &webtransport.Server{
		H3: http3.Server{
			Addr:    ":4433",
			Handler: mux,
			TLSConfig: &tls.Config{
				MinVersion: tls.VersionTLS13,
			},
		},
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	log.Println("Starting WebTransport server on :4433")
	log.Println("Server ready to accept connections")

	err := s.wtServer.ListenAndServeTLS(
		"cert/server.crt",
		"cert/server.key",
	)
	if err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
