package storage

import (
	"fmt"
	"sync"
	"time"

	"github.com/wuwenbo/rdt-simulator/backend/internal/model"
)

type Storage struct {
	mu              sync.RWMutex
	processes       map[int]*model.Process
	closGroups      map[int]*model.CLOSGroup
	history         map[int][]*model.MetricsHistory
	historyMaxSize  int
	config          *model.SystemConfig
	simulatorStatus *model.SimulatorStatus
	nextPID         int
	nextCLOSID      int
	nextRMID        int
}

func NewStorage() *Storage {
	return &Storage{
		processes:      make(map[int]*model.Process),
		closGroups:     make(map[int]*model.CLOSGroup),
		history:        make(map[int][]*model.MetricsHistory),
		historyMaxSize: 3600,
		config: &model.SystemConfig{
			TotalLLCCapacity: 100.0,
			TotalBWCapacity:  10000.0,
			UpdateIntervalMs: 1000,
			NoiseCoefficient: 0.1,
			HitRateMin:       0.3,
			HitRateMax:       0.95,
		},
		simulatorStatus: &model.SimulatorStatus{
			Running: false,
		},
		nextPID:    1000,
		nextCLOSID: 0,
		nextRMID:   0,
	}
}

func (s *Storage) GetConfig() *model.SystemConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cfg := *s.config
	return &cfg
}

func (s *Storage) UpdateConfig(cfg *model.SystemConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cfg.TotalLLCCapacity > 0 {
		s.config.TotalLLCCapacity = cfg.TotalLLCCapacity
	}
	if cfg.TotalBWCapacity > 0 {
		s.config.TotalBWCapacity = cfg.TotalBWCapacity
	}
	if cfg.UpdateIntervalMs > 0 {
		s.config.UpdateIntervalMs = cfg.UpdateIntervalMs
	}
	if cfg.NoiseCoefficient >= 0 {
		s.config.NoiseCoefficient = cfg.NoiseCoefficient
	}
	if cfg.HitRateMin > 0 {
		s.config.HitRateMin = cfg.HitRateMin
	}
	if cfg.HitRateMax > cfg.HitRateMin {
		s.config.HitRateMax = cfg.HitRateMax
	}
}

func (s *Storage) GetSimulatorStatus() *model.SimulatorStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	status := *s.simulatorStatus
	if status.Running {
		status.Uptime = time.Since(status.StartTime).Round(time.Second).String()
	}
	return &status
}

func (s *Storage) StartSimulator() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.simulatorStatus.Running = true
	s.simulatorStatus.StartTime = time.Now()
}

func (s *Storage) StopSimulator() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.simulatorStatus.Running = false
}

func (s *Storage) AddProcess(req *model.CreateProcessRequest) *model.Process {
	s.mu.Lock()
	defer s.mu.Unlock()
	pid := s.nextPID
	s.nextPID++
	rmid := req.RMID
	if rmid <= 0 {
		rmid = s.nextRMID
		s.nextRMID++
	}
	closID := req.CLOSID
	if _, exists := s.closGroups[closID]; !exists {
		closID = 0
	}
	proc := &model.Process{
		PID:        pid,
		Name:       req.Name,
		RMID:       rmid,
		CLOSID:     closID,
		LLCUsage:   0,
		LLCHitRate: 0.7,
		LLCLimit:   req.LLCLimit,
		BWLimit:    req.BWLimit,
		StartTime:  time.Now(),
		Status:     "running",
		Priority:   req.Priority,
		Throttled:  false,
	}
	s.processes[pid] = proc
	s.history[pid] = make([]*model.MetricsHistory, 0, s.historyMaxSize)
	return proc
}

func (s *Storage) GetProcess(pid int) *model.Process {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if proc, exists := s.processes[pid]; exists {
		p := *proc
		return &p
	}
	return nil
}

func (s *Storage) GetAllProcesses() []*model.Process {
	s.mu.RLock()
	defer s.mu.RUnlock()
	procs := make([]*model.Process, 0, len(s.processes))
	for _, proc := range s.processes {
		p := *proc
		procs = append(procs, &p)
	}
	return procs
}

func (s *Storage) UpdateProcess(pid int, req *model.UpdateProcessRequest) *model.Process {
	s.mu.Lock()
	defer s.mu.Unlock()
	proc, exists := s.processes[pid]
	if !exists {
		return nil
	}
	if req.Name != "" {
		proc.Name = req.Name
	}
	if req.RMID != nil {
		proc.RMID = *req.RMID
	}
	if req.CLOSID >= 0 {
		if _, ok := s.closGroups[req.CLOSID]; ok {
			proc.CLOSID = req.CLOSID
		}
	}
	if req.LLCLimit >= 0 {
		proc.LLCLimit = req.LLCLimit
	}
	if req.BWLimit >= 0 {
		proc.BWLimit = req.BWLimit
	}
	if req.Priority > 0 {
		proc.Priority = req.Priority
	}
	if req.Status != "" {
		proc.Status = req.Status
	}
	p := *proc
	return &p
}

func (s *Storage) DeleteProcess(pid int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.processes[pid]; exists {
		delete(s.processes, pid)
		delete(s.history, pid)
		return true
	}
	return false
}

func (s *Storage) GetProcessHistory(pid int, duration time.Duration) []*model.MetricsHistory {
	s.mu.RLock()
	defer s.mu.RUnlock()
	history, exists := s.history[pid]
	if !exists {
		return nil
	}
	cutoff := time.Now().Add(-duration)
	result := make([]*model.MetricsHistory, 0)
	for i := len(history) - 1; i >= 0; i-- {
		if history[i].Timestamp.After(cutoff) {
			h := *history[i]
			result = append(result, &h)
		} else {
			break
		}
	}
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result
}

func (s *Storage) AddHistoryPoint(pid int, hitRate, bw float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	history, exists := s.history[pid]
	if !exists {
		return
	}
	point := &model.MetricsHistory{
		Timestamp:  time.Now(),
		ProcessID:  pid,
		LLCHitRate: hitRate,
		MemBW:      bw,
	}
	if len(history) >= s.historyMaxSize {
		history = history[1:]
	}
	s.history[pid] = append(history, point)
}

func (s *Storage) UpdateProcessMetrics(pid int, llcUsage, hitRate, bw, readBW, writeBW float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	proc, exists := s.processes[pid]
	if !exists {
		return
	}
	proc.LLCUsage = llcUsage
	proc.LLCHitRate = hitRate
	proc.MemBandwidth = bw
	proc.ReadBandwidth = readBW
	proc.WriteBandwidth = writeBW
}

func (s *Storage) AddCLOSGroup(req *model.CreateCLOSRequest) *model.CLOSGroup {
	s.mu.Lock()
	defer s.mu.Unlock()
	id := s.nextCLOSID
	s.nextCLOSID++
	clos := &model.CLOSGroup{
		ID:        id,
		Name:      req.Name,
		CBM:       req.CBM,
		BWMbps:    req.BWMbps,
		Color:     req.Color,
		CacheWays: countBits(req.CBM),
	}
	s.closGroups[id] = clos
	c := *clos
	return &c
}

func (s *Storage) GetCLOSGroup(id int) *model.CLOSGroup {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if clos, exists := s.closGroups[id]; exists {
		c := *clos
		return &c
	}
	return nil
}

func (s *Storage) GetAllCLOSGroups() []*model.CLOSGroup {
	s.mu.RLock()
	defer s.mu.RUnlock()
	groups := make([]*model.CLOSGroup, 0, len(s.closGroups))
	for _, clos := range s.closGroups {
		c := *clos
		groups = append(groups, &c)
	}
	return groups
}

func (s *Storage) UpdateCLOSGroup(id int, req *model.UpdateCLOSRequest) *model.CLOSGroup {
	s.mu.Lock()
	defer s.mu.Unlock()
	clos, exists := s.closGroups[id]
	if !exists {
		return nil
	}
	if req.Name != "" {
		clos.Name = req.Name
	}
	if req.CBM > 0 {
		clos.CBM = req.CBM
		clos.CacheWays = countBits(req.CBM)
	}
	if req.BWMbps >= 0 {
		clos.BWMbps = req.BWMbps
	}
	if req.Color != "" {
		clos.Color = req.Color
	}
	c := *clos
	return &c
}

func (s *Storage) DeleteCLOSGroup(id int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if id == 0 {
		return false
	}
	if _, exists := s.closGroups[id]; exists {
		delete(s.closGroups, id)
		for _, proc := range s.processes {
			if proc.CLOSID == id {
				proc.CLOSID = 0
			}
		}
		return true
	}
	return false
}

func (s *Storage) GetSystemMetrics() *model.SystemMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var usedLLC, usedBW float64
	throttledCount := 0
	rmidMap := make(map[int]*model.RMIDStats)
	closLLCMap := make(map[int]float64)
	closProcMap := make(map[int]int)
	for _, proc := range s.processes {
		if proc.Status == "running" {
			usedLLC += proc.LLCUsage
			usedBW += proc.MemBandwidth
		}
		if proc.Throttled {
			throttledCount++
		}
		stats, exists := rmidMap[proc.RMID]
		if !exists {
			stats = &model.RMIDStats{RMID: proc.RMID}
			rmidMap[proc.RMID] = stats
		}
		if proc.Status == "running" {
			stats.LLCUsage += proc.LLCUsage
			stats.MemBW += proc.MemBandwidth
			closLLCMap[proc.CLOSID] += proc.LLCUsage
		}
		closProcMap[proc.CLOSID]++
	}
	rmidStats := make([]model.RMIDStats, 0, len(rmidMap))
	for _, stats := range rmidMap {
		rmidStats = append(rmidStats, *stats)
	}
	catAllocations := make([]model.CATAllocation, 0, len(s.closGroups))
	for _, clos := range s.closGroups {
		cbmBits := countBits(clos.CBM)
		llcCapacity := float64(cbmBits) / 20.0 * s.config.TotalLLCCapacity
		llcOccupancy := closLLCMap[clos.ID]
		catAllocations = append(catAllocations, model.CATAllocation{
			CLOSID:       clos.ID,
			CLOSName:     clos.Name,
			CBM:          clos.CBM,
			CacheWays:    cbmBits,
			WayMask:      fmt.Sprintf("0x%05X", clos.CBM),
			LLCOccupancy: llcOccupancy,
			LLCCapacity:  llcCapacity,
			ProcessCount: closProcMap[clos.ID],
		})
		clos.LLCOccupancy = llcOccupancy
	}
	return &model.SystemMetrics{
		Timestamp:      time.Now(),
		TotalLLC:       s.config.TotalLLCCapacity,
		UsedLLC:        usedLLC,
		TotalBW:        s.config.TotalBWCapacity,
		UsedBW:         usedBW,
		ProcessCount:   len(s.processes),
		CLOSCount:      len(s.closGroups),
		ThrottledCount: throttledCount,
		RMIDStats:      rmidStats,
		CATAllocations: catAllocations,
	}
}

func (s *Storage) UpdateProcessThrottle(pid int, throttled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if proc, exists := s.processes[pid]; exists {
		proc.Throttled = throttled
	}
}

func (s *Storage) GetProcessesByCLOS(closID int) []*model.Process {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var procs []*model.Process
	for _, proc := range s.processes {
		if proc.CLOSID == closID {
			p := *proc
			procs = append(procs, &p)
		}
	}
	return procs
}

func countBits(n uint64) int {
	count := 0
	for n > 0 {
		count += int(n & 1)
		n >>= 1
	}
	return count
}
