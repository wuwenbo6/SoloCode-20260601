package main

type SensorData struct {
	ID          int     `json:"id"`
	Timestamp   int64   `json:"ts"`
	Temperature float64 `json:"temperature"`
	Pressure    float64 `json:"pressure"`
	Vibration   float64 `json:"vibration"`
}

type ServerMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type AlertPayload struct {
	SensorID  int     `json:"sensorId"`
	Metric    string  `json:"metric"`
	Value     float64 `json:"value"`
	Threshold float64 `json:"threshold"`
	Level     string  `json:"level"`
	Timestamp int64   `json:"timestamp"`
}

type ClientMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type SubscribePayload struct {
	SensorIDs []int `json:"sensorIds"`
}

type ReplayPayload struct {
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	Speed     int    `json:"speed"`
	SensorIDs []int  `json:"sensorIds"`
}

type ThresholdPayload struct {
	Metric         string  `json:"metric"`
	Min            float64 `json:"min"`
	Max            float64 `json:"max"`
	WarningPercent float64 `json:"warningPercent"`
}

type ThresholdConfig struct {
	Metric         string  `json:"metric"`
	MinValue       float64 `json:"minValue"`
	MaxValue       float64 `json:"maxValue"`
	WarningPercent float64 `json:"warningPercent"`
}

type AlertRecord struct {
	ID           int     `json:"id"`
	SensorID     int     `json:"sensorId"`
	Metric       string  `json:"metric"`
	Value        float64 `json:"value"`
	Threshold    float64 `json:"threshold"`
	Level        string  `json:"level"`
	CreatedAt    string  `json:"createdAt"`
	Acknowledged bool    `json:"acknowledged"`
}

type SensorInfo struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Area   string `json:"area"`
	Status string `json:"status"`
}

type CongestionPayload struct {
	IntervalMs int `json:"intervalMs"`
}

type HeartbeatPayload struct {
	Timestamp int64 `json:"ts"`
}

type HeartbeatAckPayload struct {
	Timestamp int64 `json:"ts"`
	RTT       int64 `json:"rtt"`
}

type ViewState struct {
	SelectedSensors []int  `json:"selectedSensors"`
	ViewMode        string `json:"viewMode"`
	ShowPrediction  bool   `json:"showPrediction"`
	UserID          string `json:"userId"`
	UserName        string `json:"userName"`
}

type ViewStateSync struct {
	State     ViewState `json:"state"`
	SessionID string    `json:"sessionId"`
	Timestamp int64     `json:"ts"`
}
