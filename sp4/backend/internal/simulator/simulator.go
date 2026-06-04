package simulator

import (
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/wuwenbo/rdt-simulator/backend/internal/model"
	"github.com/wuwenbo/rdt-simulator/backend/internal/storage"
)

type Simulator struct {
	store       *storage.Storage
	running     bool
	stopChan    chan struct{}
	wsHub       *WSHub
	mu          sync.Mutex
	randGen     *rand.Rand
	processData map[int]*processState
}

type processState struct {
	hitRateTrend float64
	bwTrend      float64
	llcBase      float64
	bwBase       float64
}

func NewSimulator(store *storage.Storage, wsHub *WSHub) *Simulator {
	return &Simulator{
		store:       store,
		stopChan:    make(chan struct{}),
		wsHub:       wsHub,
		randGen:     rand.New(rand.NewSource(time.Now().UnixNano())),
		processData: make(map[int]*processState),
	}
}

func (s *Simulator) Start() {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.mu.Unlock()

	s.store.StartSimulator()
	go s.run()
}

func (s *Simulator) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}
	s.running = false
	close(s.stopChan)
	s.stopChan = make(chan struct{})
	s.mu.Unlock()
	s.store.StopSimulator()
}

func (s *Simulator) run() {
	cfg := s.store.GetConfig()
	ticker := time.NewTicker(time.Duration(cfg.UpdateIntervalMs) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			cfg = s.store.GetConfig()
			ticker.Reset(time.Duration(cfg.UpdateIntervalMs) * time.Millisecond)
			s.generateMetrics()
			s.pushUpdates()
		}
	}
}

func (s *Simulator) generateMetrics() {
	cfg := s.store.GetConfig()
	processes := s.store.GetAllProcesses()
	closGroups := s.store.GetAllCLOSGroups()

	closMap := make(map[int]*model.CLOSGroup)
	for _, c := range closGroups {
		closMap[c.ID] = c
	}

	s.enforceBandwidthLimits(closMap)

	for _, proc := range processes {
		if proc.Status != "running" {
			continue
		}

		if proc.Throttled {
			s.store.UpdateProcessMetrics(proc.PID, 0, 0, 0, 0, 0)
			continue
		}

		s.mu.Lock()
		state, exists := s.processData[proc.PID]
		if !exists {
			state = &processState{
				hitRateTrend: s.randGen.Float64()*0.02 - 0.01,
				bwTrend:      s.randGen.Float64()*100 - 50,
				llcBase:      5 + s.randGen.Float64()*15,
				bwBase:       200 + s.randGen.Float64()*800,
			}
			s.processData[proc.PID] = state
		}
		s.mu.Unlock()

		noise := cfg.NoiseCoefficient

		state.hitRateTrend += (s.randGen.Float64() - 0.5) * 0.01
		state.hitRateTrend = math.Max(-0.02, math.Min(0.02, state.hitRateTrend))

		state.bwTrend += (s.randGen.Float64() - 0.5) * 20
		state.bwTrend = math.Max(-200, math.Min(200, state.bwTrend))

		hitRate := proc.LLCHitRate + state.hitRateTrend + (s.randGen.Float64()-0.5)*noise*0.1
		hitRate = math.Max(cfg.HitRateMin, math.Min(cfg.HitRateMax, hitRate))

		llcUsage := state.llcBase + (s.randGen.Float64()-0.5)*noise*state.llcBase
		if clos, ok := closMap[proc.CLOSID]; ok {
			cbmBits := countBits(clos.CBM)
			maxLLC := float64(cbmBits) / 20.0 * cfg.TotalLLCCapacity
			llcUsage = math.Min(llcUsage, maxLLC)
		}
		if proc.LLCLimit > 0 {
			llcUsage = math.Min(llcUsage, proc.LLCLimit)
		}

		bw := state.bwBase + state.bwTrend + (s.randGen.Float64()-0.5)*noise*state.bwBase
		bw = math.Max(50, bw)
		if clos, ok := closMap[proc.CLOSID]; ok && clos.BWMbps > 0 {
			bw = math.Min(bw, float64(clos.BWMbps))
		}
		if proc.BWLimit > 0 {
			bw = math.Min(bw, proc.BWLimit)
		}

		readRatio := 0.5 + s.randGen.Float64()*0.3
		readBW := bw * readRatio
		writeBW := bw * (1 - readRatio)

		s.store.UpdateProcessMetrics(proc.PID, llcUsage, hitRate, bw, readBW, writeBW)
		s.store.AddHistoryPoint(proc.PID, hitRate, bw)
	}
}

func (s *Simulator) enforceBandwidthLimits(closMap map[int]*model.CLOSGroup) {
	for closID, clos := range closMap {
		procs := s.store.GetProcessesByCLOS(closID)
		throttled := closID != 0 && clos.BWMbps == 0
		for _, proc := range procs {
			s.store.UpdateProcessThrottle(proc.PID, throttled)
		}
	}
}

func countBits(n uint64) int {
	count := 0
	for n > 0 {
		count += int(n & 1)
		n >>= 1
	}
	return count
}

func (s *Simulator) pushUpdates() {
	if s.wsHub == nil {
		return
	}

	system := s.store.GetSystemMetrics()
	processes := s.store.GetAllProcesses()

	procList := make([]model.Process, len(processes))
	for i, p := range processes {
		procList[i] = *p
	}

	data := model.WSMessage{
		Type: "metrics_update",
		Data: model.WSMetricsData{
			System:    *system,
			Processes: procList,
			Timestamp: time.Now(),
		},
	}

	s.wsHub.Broadcast(data)
}

func (s *Simulator) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}
