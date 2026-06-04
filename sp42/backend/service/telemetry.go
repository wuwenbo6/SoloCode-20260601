package service

import (
	"encoding/json"
	"math"
	"sync"
	"time"
)

type TelemetryData struct {
	Timestamp int64   `json:"timestamp"`
	Altitude  float64 `json:"altitude"`
	Speed     float64 `json:"speed"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Battery   float64 `json:"battery"`
	Signal    int     `json:"signal"`
	Heading   float64 `json:"heading"`
	Mode      string  `json:"mode"`
}

type TelemetryService struct {
	mu        sync.RWMutex
	data      TelemetryData
	gs        *GimbalService
	startTime time.Time
	battery   float64
}

func NewTelemetryService(gs *GimbalService) *TelemetryService {
	return &TelemetryService{
		gs:        gs,
		startTime: time.Now(),
		battery:   25.2,
		data: TelemetryData{
			Latitude:  39.9042,
			Longitude: 116.4074,
			Mode:      "STABILIZE",
			Heading:   0,
		},
	}
}

func (t *TelemetryService) Start() {
	go t.run()
}

func (t *TelemetryService) run() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		t.update()
	}
}

func (t *TelemetryService) update() {
	elapsed := time.Since(t.startTime).Seconds()

	t.mu.Lock()
	defer t.mu.Unlock()

	t.data.Timestamp = time.Now().UnixMilli()

	t.data.Altitude = 100 + 50*math.Sin(elapsed*0.1)

	t.data.Speed = 15 + 10*math.Sin(elapsed*0.15)

	t.data.Latitude = 39.9042 + 0.001*math.Sin(elapsed*0.05)
	t.data.Longitude = 116.4074 + 0.001*math.Cos(elapsed*0.05)

	t.battery -= 0.0001
	if t.battery < 22.0 {
		t.battery = 25.2
	}
	t.data.Battery = t.battery

	t.data.Signal = int(77 + 18*math.Sin(elapsed*0.2))
	if t.data.Signal > 95 {
		t.data.Signal = 95
	}
	if t.data.Signal < 60 {
		t.data.Signal = 60
	}

	t.data.Heading = math.Mod(elapsed*10, 360)
	if t.data.Heading < 0 {
		t.data.Heading += 360
	}
}

func (t *TelemetryService) GetData() TelemetryData {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.data
}

func (t *TelemetryService) GetSnapshot() []byte {
	t.mu.RLock()
	data := t.data
	t.mu.RUnlock()

	b, err := json.Marshal(data)
	if err != nil {
		return nil
	}
	return b
}

func (t *TelemetryService) GetCombined() (TelemetryData, GimbalAngles) {
	t.mu.RLock()
	data := t.data
	t.mu.RUnlock()

	gimbal := t.gs.GetAngles()
	return data, gimbal
}
