package heartbeat

import (
	"lisp-mapserver/internal/mapping"
	"testing"
	"time"
)

func TestMonitor_EntersGracePeriod(t *testing.T) {
	store := mapping.NewStore()

	rlocs := []mapping.RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	config := Config{
		CheckInterval:   100 * time.Millisecond,
		OfflineTimeout:  300 * time.Millisecond,
		CleanupInterval: 10 * time.Second,
		CleanupAfter:    1 * time.Hour,
	}

	origGracePeriod := mapping.GracePeriodSeconds
	mapping.GracePeriodSeconds = 2
	defer func() { mapping.GracePeriodSeconds = origGracePeriod }()

	monitor := NewMonitor(store, config)
	monitor.Start()
	defer monitor.Stop()

	time.Sleep(500 * time.Millisecond)

	etr, exists := store.GetETR("192.168.1.100")
	if !exists {
		t.Fatal("expected ETR to exist")
	}
	if etr.Online {
		t.Error("expected ETR to not be online after heartbeat timeout")
	}
	if !etr.InGracePeriod {
		t.Error("expected ETR to be in grace period after heartbeat timeout")
	}
	_, exists = store.Lookup("10.0.1.0")
	if !exists {
		t.Error("expected mapping to be preserved during grace period")
	}
}

func TestMonitor_GracePeriodRevives(t *testing.T) {
	store := mapping.NewStore()

	rlocs := []mapping.RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	config := Config{
		CheckInterval:   100 * time.Millisecond,
		OfflineTimeout:  300 * time.Millisecond,
		CleanupInterval: 10 * time.Second,
		CleanupAfter:    1 * time.Hour,
	}

	origGracePeriod := mapping.GracePeriodSeconds
	mapping.GracePeriodSeconds = 2
	defer func() { mapping.GracePeriodSeconds = origGracePeriod }()

	monitor := NewMonitor(store, config)
	monitor.Start()
	defer monitor.Stop()

	time.Sleep(500 * time.Millisecond)

	etr, _ := store.GetETR("192.168.1.100")
	if !etr.InGracePeriod {
		t.Fatal("expected ETR to be in grace period")
	}

	store.UpdateETRHeartbeat("192.168.1.100")
	time.Sleep(100 * time.Millisecond)

	etr, _ = store.GetETR("192.168.1.100")
	if !etr.Online {
		t.Error("expected ETR to be back online after heartbeat in grace period")
	}
	if etr.InGracePeriod {
		t.Error("expected ETR to exit grace period after heartbeat")
	}
	if etr.OfflineSince != nil {
		t.Error("expected OfflineSince to be nil")
	}
	_, exists := store.Lookup("10.0.1.0")
	if !exists {
		t.Error("expected mapping to be preserved after revival")
	}
}

func TestMonitor_GracePeriodExpires(t *testing.T) {
	store := mapping.NewStore()

	rlocs := []mapping.RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	config := Config{
		CheckInterval:   100 * time.Millisecond,
		OfflineTimeout:  200 * time.Millisecond,
		CleanupInterval: 10 * time.Second,
		CleanupAfter:    1 * time.Hour,
	}

	origGracePeriod := mapping.GracePeriodSeconds
	mapping.GracePeriodSeconds = 1
	defer func() { mapping.GracePeriodSeconds = origGracePeriod }()

	monitor := NewMonitor(store, config)
	monitor.Start()
	defer monitor.Stop()

	time.Sleep(1500 * time.Millisecond)

	etr, exists := store.GetETR("192.168.1.100")
	if !exists {
		t.Fatal("expected ETR to exist")
	}
	if etr.InGracePeriod {
		t.Error("expected ETR to be out of grace period after expiry")
	}
	if etr.Online {
		t.Error("expected ETR to be offline after grace period expiry")
	}
	if etr.OfflineSince == nil {
		t.Error("expected OfflineSince to be set after grace period expiry")
	}
}

func TestMonitor_HeartbeatKeepsOnline(t *testing.T) {
	store := mapping.NewStore()

	rlocs := []mapping.RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	config := Config{
		CheckInterval:   100 * time.Millisecond,
		OfflineTimeout:  500 * time.Millisecond,
		CleanupInterval: 10 * time.Second,
		CleanupAfter:    1 * time.Hour,
	}

	origGracePeriod := mapping.GracePeriodSeconds
	mapping.GracePeriodSeconds = 2
	defer func() { mapping.GracePeriodSeconds = origGracePeriod }()

	monitor := NewMonitor(store, config)
	monitor.Start()
	defer monitor.Stop()

	go func() {
		for i := 0; i < 10; i++ {
			time.Sleep(200 * time.Millisecond)
			store.UpdateETRHeartbeat("192.168.1.100")
		}
	}()

	time.Sleep(600 * time.Millisecond)

	etr, exists := store.GetETR("192.168.1.100")
	if !exists {
		t.Fatal("expected ETR to exist")
	}
	if !etr.Online {
		t.Error("expected ETR to remain online with regular heartbeats")
	}
	if etr.InGracePeriod {
		t.Error("expected ETR to not enter grace period with regular heartbeats")
	}
}
