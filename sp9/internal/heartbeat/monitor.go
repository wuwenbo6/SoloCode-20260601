package heartbeat

import (
	"lisp-mapserver/internal/mapping"
	"log"
	"sync"
	"time"
)

type Config struct {
	CheckInterval   time.Duration
	OfflineTimeout  time.Duration
	CleanupInterval time.Duration
	CleanupAfter    time.Duration
}

func DefaultConfig() Config {
	return Config{
		CheckInterval:   5 * time.Second,
		OfflineTimeout:  15 * time.Second,
		CleanupInterval: 60 * time.Second,
		CleanupAfter:    10 * time.Minute,
	}
}

type Monitor struct {
	store  *mapping.Store
	config Config
	stop   chan struct{}
	wg     sync.WaitGroup
}

func NewMonitor(store *mapping.Store, config Config) *Monitor {
	return &Monitor{
		store:  store,
		config: config,
		stop:   make(chan struct{}),
	}
}

func (m *Monitor) Start() {
	m.wg.Add(2)
	go m.checkLoop()
	go m.cleanupLoop()
	log.Printf("[heartbeat] monitor started (check=%s, timeout=%s, grace=%ds)",
		m.config.CheckInterval, m.config.OfflineTimeout, mapping.GracePeriodSeconds)
}

func (m *Monitor) Stop() {
	close(m.stop)
	m.wg.Wait()
	log.Println("[heartbeat] monitor stopped")
}

func (m *Monitor) checkLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.config.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-m.stop:
			return
		case <-ticker.C:
			m.checkETRs()
			m.checkGracePeriod()
		}
	}
}

func (m *Monitor) checkETRs() {
	etrs := m.store.GetALLETRs()
	now := time.Now()
	gracePeriod := time.Duration(mapping.GracePeriodSeconds) * time.Second

	for _, etr := range etrs {
		if !etr.Online || etr.InGracePeriod {
			continue
		}
		if now.Sub(etr.LastHeartbeat) > m.config.OfflineTimeout {
			log.Printf("[heartbeat] ETR %s entering grace period (last heartbeat: %s, grace=%ds)",
				etr.ETRAddr, etr.LastHeartbeat.Format(time.RFC3339), int(gracePeriod.Seconds()))
			m.store.SetETRGracePeriod(etr.ETRAddr)
		}
	}
}

func (m *Monitor) checkGracePeriod() {
	etrs := m.store.GetALLETRs()
	now := time.Now()
	gracePeriod := time.Duration(mapping.GracePeriodSeconds) * time.Second

	for _, etr := range etrs {
		if !etr.InGracePeriod || etr.GracePeriodSince == nil {
			continue
		}
		if now.Sub(*etr.GracePeriodSince) > gracePeriod {
			log.Printf("[heartbeat] ETR %s grace period expired, marking offline", etr.ETRAddr)
			m.store.SetETROffline(etr.ETRAddr)
		}
	}
}

func (m *Monitor) cleanupLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-m.stop:
			return
		case <-ticker.C:
			m.cleanupStaleETRs()
		}
	}
}

func (m *Monitor) cleanupStaleETRs() {
	etrs := m.store.GetALLETRs()
	now := time.Now()

	for _, etr := range etrs {
		if etr.OfflineSince != nil {
			offlineDuration := now.Sub(*etr.OfflineSince)
			if offlineDuration > m.config.CleanupAfter {
				log.Printf("[heartbeat] cleaning up stale ETR %s (offline for %s)", etr.ETRAddr, offlineDuration.Truncate(time.Second))
				m.store.DeleteETRMapping(etr.ETRAddr)
			}
		}
	}
}
