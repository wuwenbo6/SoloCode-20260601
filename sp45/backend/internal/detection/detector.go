package detection

import (
	"fmt"
	"math"
	"sync"
	"time"
)

type FailureType string

const (
	FailureWarping    FailureType = "warping"
	FailureClog       FailureType = "clog"
	FailureSpaghetti  FailureType = "spaghetti"
	FailureLayerShift FailureType = "layer_shift"
	FailureStringing  FailureType = "stringing"
)

type FailureAlert struct {
	Type       FailureType `json:"type"`
	Severity   string      `json:"severity"`
	Confidence float64     `json:"confidence"`
	Message    string      `json:"message"`
	Timestamp  int64       `json:"timestamp"`
	FrameNum   int         `json:"frame_num"`
	Region     Region      `json:"region"`
}

type Region struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type DetectionConfig struct {
	Enabled         bool    `json:"enabled"`
	Sensitivity     float64 `json:"sensitivity"`
	WarpThreshold   float64 `json:"warp_threshold"`
	ClogThreshold   float64 `json:"clog_threshold"`
	AlertCooldownMs int     `json:"alert_cooldown_ms"`
	MinConfidence   float64 `json:"min_confidence"`
}

type DetectionResult struct {
	Alerts     []FailureAlert `json:"alerts"`
	FrameNum   int            `json:"frame_num"`
	Timestamp  int64          `json:"timestamp"`
	Processing float64        `json:"processing_ms"`
}

type PrintFailureDetector struct {
	mu            sync.Mutex
	config        DetectionConfig
	alerts        []FailureAlert
	lastAlertTime map[FailureType]time.Time
	frameCount    int
	enabled       bool
}

func NewPrintFailureDetector() *PrintFailureDetector {
	return &PrintFailureDetector{
		config: DetectionConfig{
			Enabled:         true,
			Sensitivity:     0.7,
			WarpThreshold:   0.15,
			ClogThreshold:   0.25,
			AlertCooldownMs: 5000,
			MinConfidence:   0.6,
		},
		alerts:        make([]FailureAlert, 0),
		lastAlertTime: make(map[FailureType]time.Time),
		enabled:       true,
	}
}

func (d *PrintFailureDetector) AnalyzeFrame(rgbData []byte, width, height int, frameNum int, timestamp int64) *DetectionResult {
	d.mu.Lock()
	defer d.mu.Unlock()

	if !d.enabled || !d.config.Enabled {
		return &DetectionResult{
			FrameNum:  frameNum,
			Timestamp: timestamp,
		}
	}

	start := time.Now()
	d.frameCount++

	var alerts []FailureAlert

	if warpAlert := d.detectWarping(rgbData, width, height, frameNum, timestamp); warpAlert != nil {
		alerts = append(alerts, *warpAlert)
	}

	if clogAlert := d.detectClog(rgbData, width, height, frameNum, timestamp); clogAlert != nil {
		alerts = append(alerts, *clogAlert)
	}

	if spaghettiAlert := d.detectSpaghetti(rgbData, width, height, frameNum, timestamp); spaghettiAlert != nil {
		alerts = append(alerts, *spaghettiAlert)
	}

	for i := range alerts {
		alerts[i].Confidence = alerts[i].Confidence * d.config.Sensitivity
	}

	filtered := d.filterAlerts(alerts)
	d.alerts = append(d.alerts, filtered...)
	if len(d.alerts) > 100 {
		d.alerts = d.alerts[len(d.alerts)-100:]
	}

	processingMs := float64(time.Since(start).Microseconds()) / 1000.0

	return &DetectionResult{
		Alerts:     filtered,
		FrameNum:   frameNum,
		Timestamp:  timestamp,
		Processing: processingMs,
	}
}

func (d *PrintFailureDetector) detectWarping(data []byte, w, h, frameNum int, ts int64) *FailureAlert {
	edgeVariance := d.calculateEdgeVariance(data, w, h, 0.1)

	if edgeVariance > d.config.WarpThreshold {
		confidence := math.Min(edgeVariance/d.config.WarpThreshold*0.8, 0.95)
		return &FailureAlert{
			Type:       FailureWarping,
			Severity:   d.severityFromConfidence(confidence),
			Confidence: confidence,
			Message:    fmt.Sprintf("检测到翘边趋势，边缘方差: %.3f", edgeVariance),
			Timestamp:  ts,
			FrameNum:   frameNum,
			Region:     Region{X: 0, Y: 0, Width: w, Height: int(float64(h) * 0.15)},
		}
	}
	return nil
}

func (d *PrintFailureDetector) detectClog(data []byte, w, h, frameNum int, ts int64) *FailureAlert {
	centerX := w / 2
	centerY := h / 2
	radius := int(float64(math.Min(float64(w), float64(h))) * 0.15)

	extrusionDensity := d.calculateRegionDensity(data, w, h, centerX-radius, centerY-radius, radius*2, radius*2)

	if extrusionDensity < d.config.ClogThreshold {
		confidence := math.Min((1.0-extrusionDensity/d.config.ClogThreshold)*0.9, 0.95)
		return &FailureAlert{
			Type:       FailureClog,
			Severity:   d.severityFromConfidence(confidence),
			Confidence: confidence,
			Message:    fmt.Sprintf("喷嘴可能堵塞，挤出密度: %.3f", extrusionDensity),
			Timestamp:  ts,
			FrameNum:   frameNum,
			Region:     Region{X: centerX - radius, Y: centerY - radius, Width: radius * 2, Height: radius * 2},
		}
	}
	return nil
}

func (d *PrintFailureDetector) detectSpaghetti(data []byte, w, h, frameNum int, ts int64) *FailureAlert {
	outsideDensity := d.calculateRegionDensity(data, w, h, 0, 0, w/4, h)

	if outsideDensity > 0.4 {
		confidence := math.Min(outsideDensity*1.2, 0.9)
		return &FailureAlert{
			Type:       FailureSpaghetti,
			Severity:   d.severityFromConfidence(confidence),
			Confidence: confidence,
			Message:    fmt.Sprintf("检测到可能的面条化打印，外围密度: %.3f", outsideDensity),
			Timestamp:  ts,
			FrameNum:   frameNum,
			Region:     Region{X: 0, Y: 0, Width: w / 4, Height: h},
		}
	}
	return nil
}

func (d *PrintFailureDetector) calculateEdgeVariance(data []byte, w, h int, edgeRatio float64) float64 {
	edgeRows := int(float64(h) * edgeRatio)
	if edgeRows < 2 {
		edgeRows = 2
	}

	var topSum, botSum float64
	var topCount, botCount int

	for y := 0; y < edgeRows; y++ {
		for x := 0; x < w; x++ {
			idx := (y*w + x) * 3
			if idx+2 < len(data) {
				brightness := float64(data[idx])*0.299 + float64(data[idx+1])*0.587 + float64(data[idx+2])*0.114
				topSum += brightness
				topCount++
			}
		}
	}

	for y := h - edgeRows; y < h; y++ {
		for x := 0; x < w; x++ {
			idx := (y*w + x) * 3
			if idx+2 < len(data) {
				brightness := float64(data[idx])*0.299 + float64(data[idx+1])*0.587 + float64(data[idx+2])*0.114
				botSum += brightness
				botCount++
			}
		}
	}

	if topCount == 0 || botCount == 0 {
		return 0
	}

	topAvg := topSum / float64(topCount)
	botAvg := botSum / float64(botCount)

	variance := math.Abs(topAvg-botAvg) / 255.0

	return variance
}

func (d *PrintFailureDetector) calculateRegionDensity(data []byte, w, h, rx, ry, rw, rh int) float64 {
	var brightPixels, totalPixels int

	for y := ry; y < ry+rh && y < h; y++ {
		for x := rx; x < rx+rw && x < w; x++ {
			idx := (y*w + x) * 3
			if idx+2 < len(data) {
				brightness := float64(data[idx])*0.299 + float64(data[idx+1])*0.587 + float64(data[idx+2])*0.114
				if brightness > 128 {
					brightPixels++
				}
				totalPixels++
			}
		}
	}

	if totalPixels == 0 {
		return 0
	}
	return float64(brightPixels) / float64(totalPixels)
}

func (d *PrintFailureDetector) filterAlerts(alerts []FailureAlert) []FailureAlert {
	var filtered []FailureAlert
	now := time.Now()

	for _, alert := range alerts {
		if alert.Confidence < d.config.MinConfidence {
			continue
		}

		if lastTime, ok := d.lastAlertTime[alert.Type]; ok {
			cooldown := time.Duration(d.config.AlertCooldownMs) * time.Millisecond
			if now.Sub(lastTime) < cooldown {
				continue
			}
		}

		d.lastAlertTime[alert.Type] = now
		filtered = append(filtered, alert)
	}

	return filtered
}

func (d *PrintFailureDetector) severityFromConfidence(confidence float64) string {
	if confidence >= 0.85 {
		return "critical"
	}
	if confidence >= 0.7 {
		return "warning"
	}
	return "info"
}

func (d *PrintFailureDetector) GetAlerts(limit int) []FailureAlert {
	d.mu.Lock()
	defer d.mu.Unlock()

	if limit <= 0 || limit > len(d.alerts) {
		limit = len(d.alerts)
	}

	result := make([]FailureAlert, limit)
	copy(result, d.alerts[len(d.alerts)-limit:])
	return result
}

func (d *PrintFailureDetector) GetConfig() DetectionConfig {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.config
}

func (d *PrintFailureDetector) SetConfig(config DetectionConfig) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.config = config
}

func (d *PrintFailureDetector) SetEnabled(enabled bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.enabled = enabled
}

func (d *PrintFailureDetector) IsEnabled() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.enabled && d.config.Enabled
}

func (d *PrintFailureDetector) ClearAlerts() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.alerts = make([]FailureAlert, 0)
	d.lastAlertTime = make(map[FailureType]time.Time)
}
