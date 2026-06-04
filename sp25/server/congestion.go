package main

import (
	"sync"
)

type CongestionController struct {
	mu          sync.Mutex
	bufferSize  int
	intervalMs  int
	minInterval int
	maxInterval int
}

func NewCongestionController() *CongestionController {
	return &CongestionController{
		intervalMs:  100,
		minInterval: 100,
		maxInterval: 500,
	}
}

func (cc *CongestionController) OnSend(n int) {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	cc.bufferSize += n
}

func (cc *CongestionController) OnAck(n int) {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	cc.bufferSize -= n
	if cc.bufferSize < 0 {
		cc.bufferSize = 0
	}
}

func (cc *CongestionController) SetBufferSize(n int) {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	cc.bufferSize = n
}

func (cc *CongestionController) GetInterval() int {
	cc.mu.Lock()
	defer cc.mu.Unlock()

	oldInterval := cc.intervalMs

	if cc.bufferSize > 128*1024 {
		cc.intervalMs = 500
	} else if cc.bufferSize > 64*1024 {
		if cc.intervalMs < 200 {
			cc.intervalMs = 200
		}
	} else if cc.bufferSize < 16*1024 {
		if cc.intervalMs > cc.minInterval {
			if cc.intervalMs >= 500 {
				cc.intervalMs = 200
			} else if cc.intervalMs >= 200 {
				cc.intervalMs = 100
			}
		}
	}

	if cc.intervalMs != oldInterval {
		return cc.intervalMs
	}
	return 0
}

func (cc *CongestionController) CurrentInterval() int {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	return cc.intervalMs
}

func (cc *CongestionController) ShouldSend() bool {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	return true
}
