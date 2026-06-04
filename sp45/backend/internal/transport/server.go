package transport

import (
	"encoding/binary"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type VideoFrame struct {
	Timestamp time.Time
	Data      []byte
	Width     int
	Height    int
	Format    string
}

type StreamClient struct {
	conn     *websocket.Conn
	sendChan chan []byte
	id       string
}

type WebTransportServer struct {
	mu           sync.Mutex
	clients      map[string]*StreamClient
	frameSource  chan *VideoFrame
	streamActive bool
	fps          int
	width        int
	height       int
}

var (
	serverInstance *WebTransportServer
	serverOnce     sync.Once
)

func GetWebTransportServer() *WebTransportServer {
	serverOnce.Do(func() {
		serverInstance = &WebTransportServer{
			clients:     make(map[string]*StreamClient),
			frameSource: make(chan *VideoFrame, 30),
			fps:         15,
			width:       640,
			height:      480,
		}
		go serverInstance.frameGenerator()
		go serverInstance.broadcastLoop()
	})
	return serverInstance
}

func (s *WebTransportServer) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	clientID := fmt.Sprintf("client-%d", time.Now().UnixNano())
	client := &StreamClient{
		conn:     conn,
		sendChan: make(chan []byte, 100),
		id:       clientID,
	}

	s.mu.Lock()
	s.clients[clientID] = client
	s.mu.Unlock()

	log.Printf("Video stream client connected: %s", clientID)

	go s.handleClient(client)
}

func (s *WebTransportServer) handleClient(client *StreamClient) {
	defer func() {
		s.mu.Lock()
		delete(s.clients, client.id)
		s.mu.Unlock()
		close(client.sendChan)
		client.conn.Close()
		log.Printf("Video stream client disconnected: %s", client.id)
	}()

	go func() {
		for {
			_, _, err := client.conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	for frame := range client.sendChan {
		err := client.conn.WriteMessage(websocket.BinaryMessage, frame)
		if err != nil {
			log.Printf("Error sending frame to %s: %v", client.id, err)
			return
		}
	}
}

func (s *WebTransportServer) frameGenerator() {
	ticker := time.NewTicker(time.Duration(1000/s.fps) * time.Millisecond)
	defer ticker.Stop()

	frameCount := 0
	for range ticker.C {
		if !s.streamActive {
			continue
		}

		frame := s.generateTestFrame(frameCount)
		frameCount++

		select {
		case s.frameSource <- frame:
		default:
		}
	}
}

func (s *WebTransportServer) generateTestFrame(frameNum int) *VideoFrame {
	width := s.width
	height := s.height
	data := make([]byte, width*height*3)

	centerX := float64(width) / 2
	centerY := float64(height) / 2
	radius := math.Min(float64(width), float64(height)) * 0.3

	t := float64(frameNum) / float64(s.fps)
	movingX := centerX + math.Sin(t*2)*radius*0.5
	movingY := centerY + math.Cos(t*1.5)*radius*0.4

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			idx := (y*width + x) * 3

			dx := float64(x) - movingX
			dy := float64(y) - movingY
			dist := math.Sqrt(dx*dx + dy*dy)

			baseR := 30 + 10*math.Sin(t*3+float64(x)*0.02)
			baseG := 40 + 15*math.Cos(t*2+float64(y)*0.02)
			baseB := 50 + 10*math.Sin(t+float64(x+y)*0.01)

			if dist < radius {
				intensity := 1.0 - dist/radius
				data[idx] = byte(baseR + intensity*225)
				data[idx+1] = byte(baseG + intensity*200)
				data[idx+2] = byte(baseB + intensity*180)
			} else {
				gridX := (x / 40) % 2
				gridY := (y / 40) % 2
				if gridX == gridY {
					data[idx] = byte(baseR + 20)
					data[idx+1] = byte(baseG + 20)
					data[idx+2] = byte(baseB + 20)
				} else {
					data[idx] = byte(baseR)
					data[idx+1] = byte(baseG)
					data[idx+2] = byte(baseB)
				}
			}

			noise := (rand.Float64() - 0.5) * 10
			data[idx] = clampByte(int(data[idx]) + int(noise))
			data[idx+1] = clampByte(int(data[idx+1]) + int(noise))
			data[idx+2] = clampByte(int(data[idx+2]) + int(noise))
		}
	}

	timestamp := time.Now().UnixMilli()
	
	header := make([]byte, 20)
	binary.LittleEndian.PutUint32(header[0:4], uint32(width))
	binary.LittleEndian.PutUint32(header[4:8], uint32(height))
	binary.LittleEndian.PutUint64(header[8:16], uint64(timestamp))
	binary.LittleEndian.PutUint32(header[16:20], uint32(frameNum))

	fullData := append(header, data...)

	return &VideoFrame{
		Timestamp: time.Now(),
		Data:      fullData,
		Width:     width,
		Height:    height,
		Format:    "RGB24",
	}
}

func clampByte(v int) byte {
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return byte(v)
}

func (s *WebTransportServer) broadcastLoop() {
	for frame := range s.frameSource {
		s.mu.Lock()
		for _, client := range s.clients {
			select {
			case client.sendChan <- frame.Data:
			default:
			}
		}
		s.mu.Unlock()
	}
}

func (s *WebTransportServer) StartStream() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.streamActive = true
	log.Println("Video stream started")
}

func (s *WebTransportServer) StopStream() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.streamActive = false
	log.Println("Video stream stopped")
}

func (s *WebTransportServer) IsStreamActive() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.streamActive
}

func (s *WebTransportServer) GetClientCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.clients)
}

func (s *WebTransportServer) SetResolution(width, height int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.width = width
	s.height = height
}

func (s *WebTransportServer) SetFPS(fps int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if fps > 0 && fps <= 60 {
		s.fps = fps
	}
}

func (s *WebTransportServer) GetStreamInfo() map[string]interface{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	return map[string]interface{}{
		"active":    s.streamActive,
		"fps":       s.fps,
		"width":     s.width,
		"height":    s.height,
		"clients":   len(s.clients),
		"transport": "websocket",
		"format":    "RGB24",
	}
}
