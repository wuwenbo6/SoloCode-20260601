package main

import (
	"sync"
)

type ThresholdManager struct {
	mu         sync.RWMutex
	thresholds map[string]ThresholdConfig
	db         *PostgresRepo
}

func NewThresholdManager(db *PostgresRepo) *ThresholdManager {
	tm := &ThresholdManager{
		thresholds: make(map[string]ThresholdConfig),
		db:         db,
	}
	tm.thresholds["temperature"] = ThresholdConfig{
		Metric:         "temperature",
		MinValue:       -20,
		MaxValue:       120,
		WarningPercent: 80,
	}
	tm.thresholds["pressure"] = ThresholdConfig{
		Metric:         "pressure",
		MinValue:       0,
		MaxValue:       10,
		WarningPercent: 85,
	}
	tm.thresholds["vibration"] = ThresholdConfig{
		Metric:         "vibration",
		MinValue:       0,
		MaxValue:       50,
		WarningPercent: 80,
	}
	return tm
}

func (tm *ThresholdManager) LoadFromDB() error {
	if tm.db == nil {
		return nil
	}
	thresholds, err := tm.db.GetThresholds()
	if err != nil {
		return err
	}
	tm.mu.Lock()
	defer tm.mu.Unlock()
	for _, t := range thresholds {
		tm.thresholds[t.Metric] = t
	}
	return nil
}

func (tm *ThresholdManager) Get(metric string) (ThresholdConfig, bool) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	t, ok := tm.thresholds[metric]
	return t, ok
}

func (tm *ThresholdManager) GetAll() []ThresholdConfig {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	result := make([]ThresholdConfig, 0, len(tm.thresholds))
	for _, t := range tm.thresholds {
		result = append(result, t)
	}
	return result
}

func (tm *ThresholdManager) Set(payload ThresholdPayload) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	cfg := ThresholdConfig{
		Metric:         payload.Metric,
		MinValue:       payload.Min,
		MaxValue:       payload.Max,
		WarningPercent: payload.WarningPercent,
	}
	tm.thresholds[payload.Metric] = cfg
	if tm.db != nil {
		return tm.db.SetThreshold(cfg)
	}
	return nil
}

func (tm *ThresholdManager) CheckSensorData(data SensorData) []AlertPayload {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	var alerts []AlertPayload
	alerts = append(alerts, tm.checkMetric(data.ID, "temperature", data.Temperature, data.Timestamp)...)
	alerts = append(alerts, tm.checkMetric(data.ID, "pressure", data.Pressure, data.Timestamp)...)
	alerts = append(alerts, tm.checkMetric(data.ID, "vibration", data.Vibration, data.Timestamp)...)
	return alerts
}

func (tm *ThresholdManager) checkMetric(sensorID int, metric string, value float64, ts int64) []AlertPayload {
	cfg, ok := tm.thresholds[metric]
	if !ok {
		return nil
	}

	var alerts []AlertPayload
	rangeSize := cfg.MaxValue - cfg.MinValue

	if value > cfg.MaxValue || value < cfg.MinValue {
		threshold := cfg.MaxValue
		if value < cfg.MinValue {
			threshold = cfg.MinValue
		}
		alerts = append(alerts, AlertPayload{
			SensorID:  sensorID,
			Metric:    metric,
			Value:     value,
			Threshold: threshold,
			Level:     "critical",
			Timestamp: ts,
		})
	} else {
		warningLow := cfg.MinValue + rangeSize*(1-cfg.WarningPercent/100)/2
		warningHigh := cfg.MaxValue - rangeSize*(1-cfg.WarningPercent/100)/2
		if value > warningHigh || value < warningLow {
			threshold := warningHigh
			if value < warningLow {
				threshold = warningLow
			}
			alerts = append(alerts, AlertPayload{
				SensorID:  sensorID,
				Metric:    metric,
				Value:     value,
				Threshold: threshold,
				Level:     "warning",
				Timestamp: ts,
			})
		}
	}

	return alerts
}
