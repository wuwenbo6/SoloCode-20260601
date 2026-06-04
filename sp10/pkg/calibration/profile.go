package calibration

import (
	"math/rand"
	"sync"
	"time"
)

type SwingMode string

const (
	SwingModeFixed    SwingMode = "fixed"
	SwingModeUniform  SwingMode = "uniform"
	SwingModeGaussian SwingMode = "gaussian"
	SwingModeSine     SwingMode = "sine"
)

type DelayProfile struct {
	BaseMs   int64     `json:"base_ms"`
	SwingMs  int64     `json:"swing_ms"`
	Mode     SwingMode `json:"mode"`
	JitterMs int64     `json:"jitter_ms"`
}

type LossProfile struct {
	Enabled      bool    `json:"enabled"`
	Rate         float64 `json:"rate"`
	BurstSize    int     `json:"burst_size"`
	burstCounter int
}

type CalibrationProfile struct {
	sync.Mutex
	ID             string       `json:"id"`
	Name           string       `json:"name"`
	PWID           uint32       `json:"pw_id"`
	Delay          DelayProfile `json:"delay"`
	Loss           LossProfile  `json:"loss"`
	PingIntervalMs int64        `json:"ping_interval_ms"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}

func NewCalibrationProfile(pwID uint32) *CalibrationProfile {
	now := time.Now()
	return &CalibrationProfile{
		ID:   generateProfileID(pwID),
		Name: "default",
		PWID: pwID,
		Delay: DelayProfile{
			BaseMs:   10,
			SwingMs:  5,
			Mode:     SwingModeFixed,
			JitterMs: 0,
		},
		Loss: LossProfile{
			Enabled:   false,
			Rate:      0.0,
			BurstSize: 0,
		},
		PingIntervalMs: 500,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func (cp *CalibrationProfile) SimulateDelay() time.Duration {
	cp.Lock()
	defer cp.Unlock()

	baseMs := cp.Delay.BaseMs
	swingMs := cp.Delay.SwingMs
	jitterMs := cp.Delay.JitterMs

	var totalMs int64

	switch cp.Delay.Mode {
	case SwingModeFixed:
		totalMs = baseMs

	case SwingModeUniform:
		if swingMs > 0 {
			offset := rand.Int63n(2*swingMs+1) - swingMs
			totalMs = baseMs + offset
		} else {
			totalMs = baseMs
		}

	case SwingModeGaussian:
		if swingMs > 0 {
			offset := int64(rand.NormFloat64() * float64(swingMs))
			totalMs = baseMs + offset
		} else {
			totalMs = baseMs
		}

	case SwingModeSine:
		if swingMs > 0 {
			phase := float64(time.Now().UnixNano()) / 1e9
			offset := int64(float64(swingMs) * sinApprox(phase))
			totalMs = baseMs + offset
		} else {
			totalMs = baseMs
		}

	default:
		totalMs = baseMs
	}

	if jitterMs > 0 {
		totalMs += rand.Int63n(2*jitterMs+1) - jitterMs
	}

	if totalMs < 0 {
		totalMs = 0
	}

	return time.Duration(totalMs) * time.Millisecond
}

func (cp *CalibrationProfile) ShouldDropPacket() bool {
	cp.Lock()
	defer cp.Unlock()

	if !cp.Loss.Enabled || cp.Loss.Rate <= 0 {
		return false
	}

	if cp.Loss.BurstSize > 0 {
		if cp.Loss.burstCounter > 0 {
			cp.Loss.burstCounter--
			return true
		}
		if rand.Float64() < cp.Loss.Rate {
			cp.Loss.burstCounter = cp.Loss.BurstSize - 1
			return true
		}
		return false
	}

	return rand.Float64() < cp.Loss.Rate
}

func (cp *CalibrationProfile) UpdateDelay(delay DelayProfile) {
	cp.Lock()
	defer cp.Unlock()
	cp.Delay = delay
	cp.UpdatedAt = time.Now()
}

func (cp *CalibrationProfile) UpdateLoss(loss LossProfile) {
	cp.Lock()
	defer cp.Unlock()
	loss.burstCounter = 0
	cp.Loss = loss
	cp.UpdatedAt = time.Now()
}

func sinApprox(x float64) float64 {
	const pi = 3.14159265358979323846
	for x > pi {
		x -= 2 * pi
	}
	for x < -pi {
		x += 2 * pi
	}
	if x < 0 {
		return -sinApprox(-x)
	}
	return x - x*x*x/6 + x*x*x*x*x/120
}

func generateProfileID(pwID uint32) string {
	return "cal-pw-" + time.Now().Format("20060102-150405")
}
