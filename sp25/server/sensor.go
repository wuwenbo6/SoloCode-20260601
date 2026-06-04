package main

import (
	"fmt"
	"math"
	"math/rand"
	"time"
)

type SensorSimulator struct {
	sensors []SensorInfo
	dataCh  chan SensorData
	quit    chan struct{}
}

func NewSensorSimulator() *SensorSimulator {
	sensors := make([]SensorInfo, 100)
	for i := 0; i < 100; i++ {
		sensors[i] = SensorInfo{
			ID:     i + 1,
			Name:   fmt.Sprintf("Sensor-%d", i+1),
			Area:   fmt.Sprintf("Area-%d", (i/10)+1),
			Status: "normal",
		}
	}
	return &SensorSimulator{
		sensors: sensors,
		dataCh:  make(chan SensorData, 10000),
		quit:    make(chan struct{}),
	}
}

func (s *SensorSimulator) Start() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	startTime := time.Now()

	for {
		select {
		case <-s.quit:
			return
		case t := <-ticker.C:
			elapsed := t.Sub(startTime).Seconds()
			for _, sensor := range s.sensors {
				data := s.generateData(sensor.ID, elapsed, t.UnixMilli())
				select {
				case s.dataCh <- data:
				default:
				}
			}
		}
	}
}

func (s *SensorSimulator) Stop() {
	close(s.quit)
}

func (s *SensorSimulator) DataChannel() <-chan SensorData {
	return s.dataCh
}

func (s *SensorSimulator) GetSensors() []SensorInfo {
	return s.sensors
}

func (s *SensorSimulator) generateData(id int, elapsed float64, ts int64) SensorData {
	phase := float64(id) * 0.1
	r := rand.Float64()

	temperature := 40.0 + math.Sin((elapsed/60.0)*2*math.Pi+phase)*15 + (rand.Float64()*4 - 2)
	if r < 0.10 {
		temperature = 100.0 + rand.Float64()*20
	}

	pressure := 5.0 + math.Sin((elapsed/45.0)*2*math.Pi+phase)*2 + (rand.Float64()*0.6 - 0.3)
	if r < 0.10 {
		pressure = 9.0 + rand.Float64()*1.5
	}

	vibration := 10.0 + math.Sin((elapsed/30.0)*2*math.Pi+phase)*8 + (rand.Float64()*2 - 1)
	if r < 0.10 {
		vibration = 40.0 + rand.Float64()*10
	}

	return SensorData{
		ID:          id,
		Timestamp:   ts,
		Temperature: temperature,
		Pressure:    pressure,
		Vibration:   vibration,
	}
}
