package mapping

import (
	"net"
	"sync"
	"time"
)

type RLOC struct {
	Address   net.IP `json:"address"`
	Priority  int    `json:"priority"`
	Weight    int    `json:"weight"`
	Multicast bool   `json:"multicast"`
}

type EIDEntry struct {
	EID        string    `json:"eid"`
	PrefixLen  int       `json:"prefix_len"`
	RLOCs      []RLOC    `json:"rlocs"`
	ETRAddr    string    `json:"etr_addr"`
	TTL        int       `json:"ttl"`
	Registered time.Time `json:"registered"`
	Updated    time.Time `json:"updated"`
}

type ETRInfo struct {
	ETRAddr           string     `json:"etr_addr"`
	Online            bool       `json:"online"`
	InGracePeriod     bool       `json:"in_grace_period"`
	LastHeartbeat     time.Time  `json:"last_heartbeat"`
	GracePeriodSince  *time.Time `json:"grace_period_since,omitempty"`
	GracePeriodRemain string     `json:"grace_period_remain,omitempty"`
	OfflineSince      *time.Time `json:"offline_since,omitempty"`
	OfflineDuration   string     `json:"offline_duration,omitempty"`
	RegisteredEIDs    []string   `json:"registered_eids"`
	MapRegisterCount  int64      `json:"map_register_count"`
}

type HeartbeatStats struct {
	TotalGracePeriodEntries int64 `json:"total_grace_period_entries"`
	TotalRecoveries         int64 `json:"total_recoveries"`
	TotalGraceExpirations   int64 `json:"total_grace_expirations"`
	TotalOfflineTransitions int64 `json:"total_offline_transitions"`
	TotalHeartbeatsReceived int64 `json:"total_heartbeats_received"`
	TotalMapRegisters       int64 `json:"total_map_registers"`
	TotalProxyReplies       int64 `json:"total_proxy_replies"`
	AvgRecoveryTimeMs       int64 `json:"avg_recovery_time_ms"`
	MinRecoveryTimeMs       int64 `json:"min_recovery_time_ms"`
	MaxRecoveryTimeMs       int64 `json:"max_recovery_time_ms"`
	RecoveryTimeSumMs       int64 `json:"-"`
}

type Store struct {
	mu             sync.RWMutex
	mappings       map[string]*EIDEntry
	etrs           map[string]*ETRInfo
	heartbeatStats HeartbeatStats
	recoveryTimes  []int64
}

func NewStore() *Store {
	return &Store{
		mappings:      make(map[string]*EIDEntry),
		etrs:          make(map[string]*ETRInfo),
		recoveryTimes: make([]int64, 0),
	}
}

func (s *Store) Register(eid string, prefixLen int, rlocs []RLOC, etrAddr string, ttl int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	entry, exists := s.mappings[eid]
	if exists {
		entry.RLOCs = rlocs
		entry.ETRAddr = etrAddr
		entry.TTL = ttl
		entry.Updated = now
	} else {
		entry = &EIDEntry{
			EID:        eid,
			PrefixLen:  prefixLen,
			RLOCs:      rlocs,
			ETRAddr:    etrAddr,
			TTL:        ttl,
			Registered: now,
			Updated:    now,
		}
		s.mappings[eid] = entry
	}

	etr, etrExists := s.etrs[etrAddr]
	if etrExists {
		etr.Online = true
		etr.InGracePeriod = false
		etr.LastHeartbeat = now
		etr.GracePeriodSince = nil
		etr.GracePeriodRemain = ""
		etr.OfflineSince = nil
		etr.OfflineDuration = ""
		etr.MapRegisterCount++
		s.heartbeatStats.TotalMapRegisters++
		found := false
		for _, e := range etr.RegisteredEIDs {
			if e == eid {
				found = true
				break
			}
		}
		if !found {
			etr.RegisteredEIDs = append(etr.RegisteredEIDs, eid)
		}
	} else {
		s.etrs[etrAddr] = &ETRInfo{
			ETRAddr:          etrAddr,
			Online:           true,
			InGracePeriod:    false,
			LastHeartbeat:    now,
			MapRegisterCount: 1,
			RegisteredEIDs:   []string{eid},
		}
		s.heartbeatStats.TotalMapRegisters++
	}
}

func (s *Store) Lookup(eid string) (*EIDEntry, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entry, exists := s.mappings[eid]
	if !exists {
		return nil, false
	}
	clone := *entry
	clone.RLOCs = make([]RLOC, len(entry.RLOCs))
	copy(clone.RLOCs, entry.RLOCs)
	return &clone, true
}

func (s *Store) GetAllMappings() []*EIDEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*EIDEntry, 0, len(s.mappings))
	for _, entry := range s.mappings {
		clone := *entry
		clone.RLOCs = make([]RLOC, len(entry.RLOCs))
		copy(clone.RLOCs, entry.RLOCs)
		result = append(result, &clone)
	}
	return result
}

func (s *Store) UpdateETRHeartbeat(etrAddr string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.heartbeatStats.TotalHeartbeatsReceived++

	etr, exists := s.etrs[etrAddr]
	if exists {
		etr.LastHeartbeat = time.Now()
		if etr.InGracePeriod && etr.GracePeriodSince != nil {
			recoveryMs := time.Since(*etr.GracePeriodSince).Milliseconds()
			s.recordRecoveryTime(recoveryMs)
			etr.Online = true
			etr.InGracePeriod = false
			etr.GracePeriodSince = nil
			etr.GracePeriodRemain = ""
			etr.OfflineSince = nil
			etr.OfflineDuration = ""
		} else if !etr.Online {
			etr.Online = true
			etr.InGracePeriod = false
			etr.GracePeriodSince = nil
			etr.GracePeriodRemain = ""
			etr.OfflineSince = nil
			etr.OfflineDuration = ""
		}
	} else {
		s.etrs[etrAddr] = &ETRInfo{
			ETRAddr:        etrAddr,
			Online:         true,
			InGracePeriod:  false,
			LastHeartbeat:  time.Now(),
			RegisteredEIDs: []string{},
		}
	}
}

func (s *Store) SetETRGracePeriod(etrAddr string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	etr, exists := s.etrs[etrAddr]
	if !exists {
		return
	}
	if etr.Online && !etr.InGracePeriod {
		now := time.Now()
		etr.Online = false
		etr.InGracePeriod = true
		etr.GracePeriodSince = &now
		s.heartbeatStats.TotalGracePeriodEntries++
	}
}

func (s *Store) SetETROffline(etrAddr string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	etr, exists := s.etrs[etrAddr]
	if !exists {
		return
	}
	if etr.InGracePeriod {
		now := time.Now()
		etr.InGracePeriod = false
		etr.OfflineSince = &now
		s.heartbeatStats.TotalGraceExpirations++
		s.heartbeatStats.TotalOfflineTransitions++
	}
}

func (s *Store) IncrementProxyReplies() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.heartbeatStats.TotalProxyReplies++
}

func (s *Store) recordRecoveryTime(ms int64) {
	s.recoveryTimes = append(s.recoveryTimes, ms)
	s.heartbeatStats.RecoveryTimeSumMs += ms
	s.heartbeatStats.TotalRecoveries++
	count := int64(len(s.recoveryTimes))
	if count > 0 {
		s.heartbeatStats.AvgRecoveryTimeMs = s.heartbeatStats.RecoveryTimeSumMs / count
	}
	if ms < s.heartbeatStats.MinRecoveryTimeMs || s.heartbeatStats.MinRecoveryTimeMs == 0 {
		s.heartbeatStats.MinRecoveryTimeMs = ms
	}
	if ms > s.heartbeatStats.MaxRecoveryTimeMs {
		s.heartbeatStats.MaxRecoveryTimeMs = ms
	}
}

func (s *Store) GetHeartbeatStats() HeartbeatStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	stats := s.heartbeatStats
	return stats
}

var GracePeriodSeconds = 120

func (s *Store) GetALLETRs() []*ETRInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	gracePeriod := time.Duration(GracePeriodSeconds) * time.Second
	result := make([]*ETRInfo, 0, len(s.etrs))
	for _, etr := range s.etrs {
		copy := *etr
		if copy.InGracePeriod && copy.GracePeriodSince != nil {
			elapsed := time.Since(*copy.GracePeriodSince)
			remain := gracePeriod - elapsed
			if remain < 0 {
				remain = 0
			}
			copy.GracePeriodRemain = remain.Truncate(time.Second).String()
		}
		if copy.OfflineSince != nil {
			offlineSince := *copy.OfflineSince
			copy.OfflineDuration = time.Since(offlineSince).Truncate(time.Second).String()
		}
		result = append(result, &copy)
	}
	return result
}

func (s *Store) GetETR(etrAddr string) (*ETRInfo, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	etr, exists := s.etrs[etrAddr]
	if !exists {
		return nil, false
	}
	gracePeriod := time.Duration(GracePeriodSeconds) * time.Second
	copy := *etr
	if copy.InGracePeriod && copy.GracePeriodSince != nil {
		elapsed := time.Since(*copy.GracePeriodSince)
		remain := gracePeriod - elapsed
		if remain < 0 {
			remain = 0
		}
		copy.GracePeriodRemain = remain.Truncate(time.Second).String()
	}
	if copy.OfflineSince != nil {
		offlineSince := *copy.OfflineSince
		copy.OfflineDuration = time.Since(offlineSince).Truncate(time.Second).String()
	}
	return &copy, true
}

func (s *Store) DeleteETRMapping(etrAddr string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for eid, entry := range s.mappings {
		if entry.ETRAddr == etrAddr {
			delete(s.mappings, eid)
		}
	}
	delete(s.etrs, etrAddr)
}
