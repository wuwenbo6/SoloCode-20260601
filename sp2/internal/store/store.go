package store

import (
	"netflow-collector/internal/netflow"
	"sync"
	"time"
)

const MaxFlowsPerObserver = 10000

type FlowRecord struct {
	SourceID   uint32                 `json:"sourceId"`
	TemplateID uint16                 `json:"templateId"`
	Fields     map[string]interface{} `json:"fields"`
	ReceivedAt time.Time              `json:"receivedAt"`
}

type Observer struct {
	SourceID      uint32    `json:"sourceId"`
	Address       string    `json:"address"`
	LastSeen      time.Time `json:"lastSeen"`
	TemplateCount int       `json:"templateCount"`
	FlowCount     int       `json:"flowCount"`
}

type Stats struct {
	Packets   int64 `json:"packets"`
	Templates int64 `json:"templates"`
	Observers int64 `json:"observers"`
	Flows     int64 `json:"flows"`
}

type Store struct {
	mu        sync.RWMutex
	observers map[uint32]*Observer
	flows     map[uint32][]FlowRecord
	flowCount int64
	pktCount  int64
	tmplMgr   *netflow.TemplateManager

	rateMu  sync.RWMutex
	rateBuf []time.Time
}

func NewStore(tmplMgr *netflow.TemplateManager) *Store {
	return &Store{
		observers: make(map[uint32]*Observer),
		flows:     make(map[uint32][]FlowRecord),
		tmplMgr:   tmplMgr,
		rateBuf:   make([]time.Time, 0),
	}
}

func (s *Store) RecordPacket(sourceID uint32, addr string) {
	s.mu.Lock()
	s.pktCount++

	if obs, ok := s.observers[sourceID]; ok {
		obs.LastSeen = time.Now()
		obs.Address = addr
	} else {
		s.observers[sourceID] = &Observer{
			SourceID: sourceID,
			Address:  addr,
			LastSeen: time.Now(),
		}
	}
	s.mu.Unlock()
}

func (s *Store) RecordTemplate(sourceID uint32) {
	s.mu.Lock()
	if obs, ok := s.observers[sourceID]; ok {
		obs.TemplateCount = len(s.tmplMgr.GetTemplatesBySource(sourceID))
	}
	s.mu.Unlock()
}

func (s *Store) AddFlow(sourceID uint32, templateID uint16, fields map[string]interface{}) {
	s.mu.Lock()
	rec := FlowRecord{
		SourceID:   sourceID,
		TemplateID: templateID,
		Fields:     fields,
		ReceivedAt: time.Now(),
	}

	s.flows[sourceID] = append(s.flows[sourceID], rec)
	if len(s.flows[sourceID]) > MaxFlowsPerObserver {
		s.flows[sourceID] = s.flows[sourceID][len(s.flows[sourceID])-MaxFlowsPerObserver:]
	}
	s.flowCount++

	if obs, ok := s.observers[sourceID]; ok {
		obs.FlowCount = len(s.flows[sourceID])
	}
	s.mu.Unlock()

	s.rateMu.Lock()
	s.rateBuf = append(s.rateBuf, time.Now())
	cutoff := time.Now().Add(-60 * time.Second)
	i := 0
	for i < len(s.rateBuf) && s.rateBuf[i].Before(cutoff) {
		i++
	}
	s.rateBuf = s.rateBuf[i:]
	s.rateMu.Unlock()
}

func (s *Store) GetStats() Stats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return Stats{
		Packets:   s.pktCount,
		Templates: int64(s.tmplMgr.Count()),
		Observers: int64(len(s.observers)),
		Flows:     s.flowCount,
	}
}

func (s *Store) GetObservers() []Observer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]Observer, 0, len(s.observers))
	for _, obs := range s.observers {
		result = append(result, *obs)
	}
	return result
}

func (s *Store) GetObserver(sourceID uint32) *Observer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if obs, ok := s.observers[sourceID]; ok {
		cp := *obs
		return &cp
	}
	return nil
}

func (s *Store) GetFlows(sourceID uint32, templateID uint16, page int, pageSize int) ([]FlowRecord, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	allFlows, ok := s.flows[sourceID]
	if !ok {
		return nil, 0
	}

	var filtered []FlowRecord
	if templateID > 0 {
		for _, f := range allFlows {
			if f.TemplateID == templateID {
				filtered = append(filtered, f)
			}
		}
	} else {
		filtered = allFlows
	}

	total := len(filtered)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	start := (page - 1) * pageSize
	if start >= total {
		return nil, total
	}

	end := start + pageSize
	if end > total {
		end = total
	}

	result := make([]FlowRecord, end-start)
	copy(result, filtered[start:end])
	return result, total
}

func (s *Store) ClearFlowsByTemplate(sourceID uint32, templateID uint16) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	allFlows, ok := s.flows[sourceID]
	if !ok {
		return 0
	}

	var remaining []FlowRecord
	cleared := 0
	for _, f := range allFlows {
		if f.TemplateID == templateID {
			cleared++
		} else {
			remaining = append(remaining, f)
		}
	}

	s.flows[sourceID] = remaining
	s.flowCount -= int64(cleared)

	if obs, ok := s.observers[sourceID]; ok {
		obs.FlowCount = len(remaining)
	}

	return cleared
}

func (s *Store) GetFlowRate() float64 {
	s.rateMu.RLock()
	defer s.rateMu.RUnlock()

	cutoff := time.Now().Add(-60 * time.Second)
	count := 0
	for _, t := range s.rateBuf {
		if t.After(cutoff) {
			count++
		}
	}
	return float64(count) / 60.0
}
