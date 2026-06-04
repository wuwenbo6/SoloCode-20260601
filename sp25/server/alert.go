package main

import (
	"sync"
	"time"
)

const (
	alertDedupWindow   = 30 * time.Second
	maxAlertsPerMinute = 3
)

type AlertDedupKey struct {
	SensorID int
	Metric   string
	Level    string
}

type AlertState struct {
	LastSent    int64
	Count       int
	MinuteStart int64
}

type AlertEngine struct {
	mu         sync.Mutex
	alertState map[AlertDedupKey]*AlertState
	db         *PostgresRepo
	threshold  *ThresholdManager
}

func NewAlertEngine(db *PostgresRepo, tm *ThresholdManager) *AlertEngine {
	return &AlertEngine{
		alertState: make(map[AlertDedupKey]*AlertState),
		db:         db,
		threshold:  tm,
	}
}

func (ae *AlertEngine) ProcessData(data SensorData) []AlertPayload {
	alerts := ae.threshold.CheckSensorData(data)
	if len(alerts) == 0 {
		ae.clearOldAlerts()
		return nil
	}

	ae.mu.Lock()
	defer ae.mu.Unlock()

	var result []AlertPayload
	now := time.Now().UnixMilli()
	minuteWindow := now / 60000 * 60000

	for _, alert := range alerts {
		key := AlertDedupKey{SensorID: alert.SensorID, Metric: alert.Metric, Level: alert.Level}
		state, exists := ae.alertState[key]

		if !exists {
			state = &AlertState{LastSent: 0, Count: 0, MinuteStart: minuteWindow}
			ae.alertState[key] = state
		}

		if state.MinuteStart != minuteWindow {
			state.Count = 0
			state.MinuteStart = minuteWindow
		}

		if (now - state.LastSent) < alertDedupWindow.Milliseconds() {
			continue
		}

		if state.Count >= maxAlertsPerMinute {
			continue
		}

		state.LastSent = now
		state.Count++

		alert.Timestamp = now
		result = append(result, alert)

		if ae.db != nil {
			go func(a AlertPayload) {
				ae.db.InsertAlert(a)
			}(alert)
		}
	}

	return result
}

func (ae *AlertEngine) clearOldAlerts() {
	ae.mu.Lock()
	defer ae.mu.Unlock()

	now := time.Now().UnixMilli()
	for key, state := range ae.alertState {
		if (now - state.LastSent) > alertDedupWindow.Milliseconds()*2 {
			delete(ae.alertState, key)
		}
	}
}

func (ae *AlertEngine) UpdateSensorStatus(sensors []SensorInfo, data SensorData) []SensorInfo {
	alerts := ae.threshold.CheckSensorData(data)
	status := "normal"
	for _, a := range alerts {
		if a.Level == "critical" {
			status = "critical"
			break
		}
		if a.Level == "warning" {
			status = "warning"
		}
	}

	for i := range sensors {
		if sensors[i].ID == data.ID {
			sensors[i].Status = status
			break
		}
	}
	return sensors
}
