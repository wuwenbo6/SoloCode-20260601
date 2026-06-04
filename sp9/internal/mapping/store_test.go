package mapping

import (
	"testing"
	"time"
)

func TestStore_Register(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{
		{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100},
		{Address: []byte{192, 168, 1, 2}, Priority: 2, Weight: 50},
	}

	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	entry, exists := store.Lookup("10.0.1.0")
	if !exists {
		t.Fatal("expected mapping to exist")
	}
	if entry.EID != "10.0.1.0" {
		t.Errorf("expected EID 10.0.1.0, got %s", entry.EID)
	}
	if entry.PrefixLen != 24 {
		t.Errorf("expected prefix len 24, got %d", entry.PrefixLen)
	}
	if entry.ETRAddr != "192.168.1.100" {
		t.Errorf("expected ETR addr 192.168.1.100, got %s", entry.ETRAddr)
	}
	if len(entry.RLOCs) != 2 {
		t.Errorf("expected 2 RLOCs, got %d", len(entry.RLOCs))
	}
}

func TestStore_RegisterUpdatesExisting(t *testing.T) {
	store := NewStore()

	rlocs1 := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs1, "192.168.1.100", 60)

	rlocs2 := []RLOC{
		{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100},
		{Address: []byte{192, 168, 1, 2}, Priority: 2, Weight: 50},
	}
	store.Register("10.0.1.0", 24, rlocs2, "192.168.1.100", 60)

	entry, _ := store.Lookup("10.0.1.0")
	if len(entry.RLOCs) != 2 {
		t.Errorf("expected 2 RLOCs after update, got %d", len(entry.RLOCs))
	}
}

func TestStore_GetALLETRs(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	etrs := store.GetALLETRs()
	if len(etrs) != 1 {
		t.Fatalf("expected 1 ETR, got %d", len(etrs))
	}
	if !etrs[0].Online {
		t.Error("expected ETR to be online")
	}
	if etrs[0].ETRAddr != "192.168.1.100" {
		t.Errorf("expected ETR addr 192.168.1.100, got %s", etrs[0].ETRAddr)
	}
}

func TestStore_SetETRGracePeriod(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")

	etr, exists := store.GetETR("192.168.1.100")
	if !exists {
		t.Fatal("expected ETR to exist")
	}
	if etr.Online {
		t.Error("expected ETR to be in grace period, not online")
	}
	if !etr.InGracePeriod {
		t.Error("expected InGracePeriod to be true")
	}
	if etr.GracePeriodSince == nil {
		t.Error("expected GracePeriodSince to be set")
	}
	_, exists = store.Lookup("10.0.1.0")
	if !exists {
		t.Error("expected mapping to be preserved during grace period")
	}
}

func TestStore_HeartbeatRevivesFromGracePeriod(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")

	etr, _ := store.GetETR("192.168.1.100")
	if !etr.InGracePeriod {
		t.Fatal("expected ETR to be in grace period")
	}

	store.UpdateETRHeartbeat("192.168.1.100")

	etr, _ = store.GetETR("192.168.1.100")
	if !etr.Online {
		t.Error("expected ETR to be back online after heartbeat")
	}
	if etr.InGracePeriod {
		t.Error("expected InGracePeriod to be false after revival")
	}
	if etr.GracePeriodSince != nil {
		t.Error("expected GracePeriodSince to be nil after revival")
	}
	_, exists := store.Lookup("10.0.1.0")
	if !exists {
		t.Error("expected mapping to be preserved after revival")
	}
}

func TestStore_SetETROfflineFromGracePeriod(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")
	store.SetETROffline("192.168.1.100")

	etr, _ := store.GetETR("192.168.1.100")
	if etr.InGracePeriod {
		t.Error("expected InGracePeriod to be false after offline")
	}
	if etr.Online {
		t.Error("expected Online to be false after offline")
	}
	if etr.OfflineSince == nil {
		t.Error("expected OfflineSince to be set after grace period expiry")
	}
}

func TestStore_GracePeriodRemain(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")
	time.Sleep(100 * time.Millisecond)

	etr, _ := store.GetETR("192.168.1.100")
	if etr.GracePeriodRemain == "" {
		t.Error("expected grace period remain to be set")
	}
}

func TestStore_SetETROffline(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")
	store.SetETROffline("192.168.1.100")

	etr, exists := store.GetETR("192.168.1.100")
	if !exists {
		t.Fatal("expected ETR to exist")
	}
	if etr.Online {
		t.Error("expected ETR to be offline")
	}
	if etr.OfflineSince == nil {
		t.Error("expected OfflineSince to be set")
	}
}

func TestStore_HeartbeatRevives(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")
	store.SetETROffline("192.168.1.100")

	store.UpdateETRHeartbeat("192.168.1.100")

	etr, _ := store.GetETR("192.168.1.100")
	if !etr.Online {
		t.Error("expected ETR to be back online after heartbeat")
	}
	if etr.OfflineSince != nil {
		t.Error("expected OfflineSince to be nil after heartbeat revive")
	}
	if etr.InGracePeriod {
		t.Error("expected InGracePeriod to be false after heartbeat revive")
	}
}

func TestStore_DeleteETRMapping(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)
	store.Register("10.0.2.0", 24, rlocs, "192.168.1.100", 60)

	store.DeleteETRMapping("192.168.1.100")

	_, exists := store.Lookup("10.0.1.0")
	if exists {
		t.Error("expected mapping to be deleted")
	}
	_, exists = store.Lookup("10.0.2.0")
	if exists {
		t.Error("expected mapping to be deleted")
	}
	_, exists = store.GetETR("192.168.1.100")
	if exists {
		t.Error("expected ETR to be deleted")
	}
}

func TestStore_OfflineDuration(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")
	store.SetETROffline("192.168.1.100")

	time.Sleep(100 * time.Millisecond)

	etr, _ := store.GetETR("192.168.1.100")
	if etr.OfflineDuration == "" {
		t.Error("expected offline duration to be set")
	}
}

func TestStore_HeartbeatStats_Basic(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	stats := store.GetHeartbeatStats()
	if stats.TotalMapRegisters != 1 {
		t.Errorf("expected 1 map register, got %d", stats.TotalMapRegisters)
	}

	store.UpdateETRHeartbeat("192.168.1.100")
	stats = store.GetHeartbeatStats()
	if stats.TotalHeartbeatsReceived != 1 {
		t.Errorf("expected 1 heartbeat received, got %d", stats.TotalHeartbeatsReceived)
	}
}

func TestStore_HeartbeatStats_GracePeriod(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")

	stats := store.GetHeartbeatStats()
	if stats.TotalGracePeriodEntries != 1 {
		t.Errorf("expected 1 grace period entry, got %d", stats.TotalGracePeriodEntries)
	}
	if stats.TotalRecoveries != 0 {
		t.Errorf("expected 0 recoveries, got %d", stats.TotalRecoveries)
	}
	if stats.TotalGraceExpirations != 0 {
		t.Errorf("expected 0 grace expirations, got %d", stats.TotalGraceExpirations)
	}
}

func TestStore_HeartbeatStats_Recovery(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")
	time.Sleep(10 * time.Millisecond)
	store.UpdateETRHeartbeat("192.168.1.100")

	stats := store.GetHeartbeatStats()
	if stats.TotalRecoveries != 1 {
		t.Errorf("expected 1 recovery, got %d", stats.TotalRecoveries)
	}
	if stats.MinRecoveryTimeMs == 0 {
		t.Error("expected min recovery time to be set")
	}
	if stats.AvgRecoveryTimeMs == 0 {
		t.Error("expected avg recovery time to be set")
	}
}

func TestStore_HeartbeatStats_Expiration(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")
	store.SetETROffline("192.168.1.100")

	stats := store.GetHeartbeatStats()
	if stats.TotalGraceExpirations != 1 {
		t.Errorf("expected 1 grace expiration, got %d", stats.TotalGraceExpirations)
	}
	if stats.TotalOfflineTransitions != 1 {
		t.Errorf("expected 1 offline transition, got %d", stats.TotalOfflineTransitions)
	}
}

func TestStore_HeartbeatStats_ProxyReplies(t *testing.T) {
	store := NewStore()

	store.IncrementProxyReplies()
	store.IncrementProxyReplies()
	store.IncrementProxyReplies()

	stats := store.GetHeartbeatStats()
	if stats.TotalProxyReplies != 3 {
		t.Errorf("expected 3 proxy replies, got %d", stats.TotalProxyReplies)
	}
}

func TestStore_HeartbeatStats_MultipleRecoveries(t *testing.T) {
	store := NewStore()

	rlocs := []RLOC{{Address: []byte{192, 168, 1, 1}, Priority: 1, Weight: 100}}
	store.Register("10.0.1.0", 24, rlocs, "192.168.1.100", 60)

	store.SetETRGracePeriod("192.168.1.100")
	time.Sleep(10 * time.Millisecond)
	store.UpdateETRHeartbeat("192.168.1.100")

	time.Sleep(10 * time.Millisecond)
	store.SetETRGracePeriod("192.168.1.100")
	time.Sleep(20 * time.Millisecond)
	store.UpdateETRHeartbeat("192.168.1.100")

	stats := store.GetHeartbeatStats()
	if stats.TotalRecoveries != 2 {
		t.Errorf("expected 2 recoveries, got %d", stats.TotalRecoveries)
	}
	if stats.TotalGracePeriodEntries != 2 {
		t.Errorf("expected 2 grace period entries, got %d", stats.TotalGracePeriodEntries)
	}
	if stats.AvgRecoveryTimeMs == 0 {
		t.Error("expected avg recovery time to be set")
	}
}
