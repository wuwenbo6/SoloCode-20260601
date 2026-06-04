package service

import (
	"encoding/json"
	"sync"
)

type GimbalAngles struct {
	Yaw   float64 `json:"yaw"`
	Pitch float64 `json:"pitch"`
	Roll  float64 `json:"roll"`
}

type GimbalService struct {
	mu     sync.RWMutex
	angles GimbalAngles
	subs   []chan GimbalAngles
	subMu  sync.Mutex
}

func NewGimbalService() *GimbalService {
	return &GimbalService{
		angles: GimbalAngles{Yaw: 0, Pitch: 0, Roll: 0},
	}
}

func (g *GimbalService) SetAngles(angles GimbalAngles) {
	g.mu.Lock()
	g.angles = angles
	g.mu.Unlock()

	g.subMu.Lock()
	defer g.subMu.Unlock()
	for _, ch := range g.subs {
		select {
		case ch <- angles:
		default:
		}
	}
}

func (g *GimbalService) GetAngles() GimbalAngles {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.angles
}

func (g *GimbalService) GetAnglesJSON() []byte {
	angles := g.GetAngles()
	b, _ := json.Marshal(angles)
	return b
}

func (g *GimbalService) Subscribe() chan GimbalAngles {
	ch := make(chan GimbalAngles, 10)
	g.subMu.Lock()
	g.subs = append(g.subs, ch)
	g.subMu.Unlock()
	return ch
}

func (g *GimbalService) Unsubscribe(ch chan GimbalAngles) {
	g.subMu.Lock()
	defer g.subMu.Unlock()
	for i, sub := range g.subs {
		if sub == ch {
			g.subs = append(g.subs[:i], g.subs[i+1:]...)
			close(ch)
			return
		}
	}
}
