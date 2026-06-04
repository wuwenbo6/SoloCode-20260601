package main

import (
	"sync"
	"testing"
)

func TestTransactionInitialState(t *testing.T) {
	txn := NewTransaction(nil, nil)
	if txn.State() != StateIdle {
		t.Errorf("expected Idle, got %s", txn.State())
	}
}

func TestTransactionSendInvite(t *testing.T) {
	txn := NewTransaction(nil, nil)
	from, to, ok := txn.HandleEvent(EventSendInvite)
	if !ok {
		t.Fatal("expected transition to succeed")
	}
	if from != StateIdle || to != StateCalling {
		t.Errorf("expected Idle -> Calling, got %s -> %s", from, to)
	}
}

func TestTransactionFullHappyPath(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv1xx)
	txn.HandleEvent(EventRecv2xx)
	if txn.State() != StateTerminated {
		t.Fatalf("expected Terminated, got %s", txn.State())
	}
}

func TestTransactionRecv3xxGoesToTerminated(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv3xx6xx)
	if txn.State() != StateTerminated {
		t.Fatalf("expected Terminated, got %s", txn.State())
	}
}

func TestTransactionAutoAckOn3xx(t *testing.T) {
	var mu sync.Mutex
	var autoEvents []SIPEvent

	autoHandler := func(event SIPEvent, message string, timestamp int64) {
		mu.Lock()
		defer mu.Unlock()
		autoEvents = append(autoEvents, event)
	}

	txn := NewTransaction(nil, autoHandler)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv3xx6xx)

	mu.Lock()
	defer mu.Unlock()
	if len(autoEvents) != 1 || autoEvents[0] != EventAckSent {
		t.Errorf("expected auto ACK, got %v", autoEvents)
	}
}

func TestTransactionAutoCancelOnTimerB(t *testing.T) {
	var mu sync.Mutex
	var autoEvents []SIPEvent

	autoHandler := func(event SIPEvent, message string, timestamp int64) {
		mu.Lock()
		defer mu.Unlock()
		autoEvents = append(autoEvents, event)
	}

	txn := NewTransaction(nil, autoHandler)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventTimerB)

	mu.Lock()
	defer mu.Unlock()
	if len(autoEvents) != 1 || autoEvents[0] != EventCancelSent {
		t.Errorf("expected auto CANCEL, got %v", autoEvents)
	}
	if txn.State() != StateTerminated {
		t.Errorf("expected Terminated, got %s", txn.State())
	}
}

func TestTransactionRecv401AutoRetry(t *testing.T) {
	var mu sync.Mutex
	var autoEvents []SIPEvent

	autoHandler := func(event SIPEvent, message string, timestamp int64) {
		mu.Lock()
		defer mu.Unlock()
		autoEvents = append(autoEvents, event)
	}

	txn := NewTransaction(nil, autoHandler)
	txn.HandleEvent(EventSendInvite)
	from, to, ok := txn.HandleEvent(EventRecv401)
	if !ok {
		t.Fatal("expected 401 transition to succeed")
	}
	if from != StateCalling || to != StateCalling {
		t.Errorf("expected Calling -> Calling (retry), got %s -> %s", from, to)
	}
	if txn.State() != StateCalling {
		t.Errorf("expected Calling after 401 retry, got %s", txn.State())
	}

	mu.Lock()
	defer mu.Unlock()
	if len(autoEvents) != 1 || autoEvents[0] != EventInviteAuth {
		t.Errorf("expected auto INVITE+Auth, got %v", autoEvents)
	}
}

func TestTransactionRecv407AutoRetry(t *testing.T) {
	var mu sync.Mutex
	var autoEvents []SIPEvent

	autoHandler := func(event SIPEvent, message string, timestamp int64) {
		mu.Lock()
		defer mu.Unlock()
		autoEvents = append(autoEvents, event)
	}

	txn := NewTransaction(nil, autoHandler)
	txn.HandleEvent(EventSendInvite)
	from, to, ok := txn.HandleEvent(EventRecv407)
	if !ok {
		t.Fatal("expected 407 transition to succeed")
	}
	if from != StateCalling || to != StateCalling {
		t.Errorf("expected Calling -> Calling (retry), got %s -> %s", from, to)
	}

	mu.Lock()
	defer mu.Unlock()
	if len(autoEvents) != 1 || autoEvents[0] != EventInvitePrxAuth {
		t.Errorf("expected auto INVITE+Proxy-Auth, got %v", autoEvents)
	}
}

func TestTransactionAuthRetryLimit(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)

	for i := 0; i < 3; i++ {
		_, _, ok := txn.HandleEvent(EventRecv401)
		if !ok {
			t.Fatalf("expected 401 retry %d to succeed", i+1)
		}
		if txn.State() != StateCalling {
			t.Errorf("expected Calling after retry %d, got %s", i+1, txn.State())
		}
	}

	_, to, ok := txn.HandleEvent(EventRecv401)
	if !ok {
		t.Fatal("expected 4th 401 to succeed (but go to Terminated)")
	}
	if to != StateTerminated {
		t.Errorf("expected Terminated after max retries, got %s", to)
	}
}

func TestTransaction401FromProceeding(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv1xx)

	from, to, ok := txn.HandleEvent(EventRecv401)
	if !ok {
		t.Fatal("expected 401 from Proceeding to succeed")
	}
	if from != StateProceeding || to != StateCalling {
		t.Errorf("expected Proceeding -> Calling, got %s -> %s", from, to)
	}
}

func TestTransaction407FromProceeding(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv1xx)

	from, to, ok := txn.HandleEvent(EventRecv407)
	if !ok {
		t.Fatal("expected 407 from Proceeding to succeed")
	}
	if from != StateProceeding || to != StateCalling {
		t.Errorf("expected Proceeding -> Calling, got %s -> %s", from, to)
	}
}

func TestTransactionInvalidEvent(t *testing.T) {
	txn := NewTransaction(nil, nil)
	_, _, ok := txn.HandleEvent(EventRecv1xx)
	if ok {
		t.Error("expected event to be rejected in Idle state")
	}
}

func TestTransactionProceedingSelfLoop(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv1xx)

	from, to, ok := txn.HandleEvent(EventRecv1xx)
	if !ok || from != StateProceeding || to != StateProceeding {
		t.Errorf("expected Proceeding -> Proceeding, got %s -> %s, ok=%v", from, to, ok)
	}
}

func TestTransactionReset(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv1xx)
	txn.Reset()
	if txn.State() != StateIdle {
		t.Errorf("expected Idle after reset, got %s", txn.State())
	}
}

func TestTransactionResetClearsAuthRetry(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv401)
	txn.HandleEvent(EventRecv401)
	txn.Reset()

	txn.HandleEvent(EventSendInvite)
	_, to, _ := txn.HandleEvent(EventRecv401)
	if to != StateCalling {
		t.Errorf("expected Calling after reset+401, got %s", to)
	}
}

func TestTransactionStateLog(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv1xx)
	txn.HandleEvent(EventRecv2xx)

	logs := txn.GetStateLog()
	if len(logs) != 3 {
		t.Fatalf("expected 3 log entries, got %d", len(logs))
	}
	if logs[0].From != StateIdle || logs[0].To != StateCalling {
		t.Errorf("entry 0: expected Idle -> Calling, got %s -> %s", logs[0].From, logs[0].To)
	}
	if logs[1].From != StateCalling || logs[1].To != StateProceeding {
		t.Errorf("entry 1: expected Calling -> Proceeding, got %s -> %s", logs[1].From, logs[1].To)
	}
	if logs[2].From != StateProceeding || logs[2].To != StateTerminated {
		t.Errorf("entry 2: expected Proceeding -> Terminated, got %s -> %s", logs[2].From, logs[2].To)
	}
}

func TestTransactionClearStateLog(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	if len(txn.GetStateLog()) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(txn.GetStateLog()))
	}
	txn.ClearStateLog()
	if len(txn.GetStateLog()) != 0 {
		t.Errorf("expected 0 entries after clear, got %d", len(txn.GetStateLog()))
	}
}

func TestTransactionValidEventsIncludes401(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	events := txn.ValidEvents()

	found401 := false
	found407 := false
	for _, e := range events {
		if e == EventRecv401 {
			found401 = true
		}
		if e == EventRecv407 {
			found407 = true
		}
	}
	if !found401 {
		t.Error("expected recv_401 in Calling valid events")
	}
	if !found407 {
		t.Error("expected recv_407 in Calling valid events")
	}
}

func TestEventDirection(t *testing.T) {
	tests := []struct {
		event    SIPEvent
		expected string
	}{
		{EventSendInvite, "send"},
		{EventAckSent, "send"},
		{EventCancelSent, "send"},
		{EventInviteAuth, "send"},
		{EventInvitePrxAuth, "send"},
		{EventRecv1xx, "recv"},
		{EventRecv2xx, "recv"},
		{EventRecv3xx6xx, "recv"},
		{EventRecv401, "recv"},
		{EventRecv407, "recv"},
		{EventTimerB, "internal"},
		{EventTimerD, "internal"},
	}
	for _, tt := range tests {
		if got := EventDirection(tt.event); got != tt.expected {
			t.Errorf("EventDirection(%s) = %s, want %s", tt.event, got, tt.expected)
		}
	}
}

func TestEventLabel(t *testing.T) {
	tests := []struct {
		event    SIPEvent
		expected string
	}{
		{EventSendInvite, "INVITE"},
		{EventRecv1xx, "1xx (Ringing)"},
		{EventRecv2xx, "2xx (OK)"},
		{EventRecv3xx6xx, "3xx-6xx (Busy/Redir)"},
		{EventRecv401, "401 (Unauthorized)"},
		{EventRecv407, "407 (Proxy Auth)"},
		{EventAckSent, "ACK"},
		{EventCancelSent, "CANCEL"},
		{EventInviteAuth, "INVITE (+Auth)"},
		{EventInvitePrxAuth, "INVITE (+Proxy-Auth)"},
	}
	for _, tt := range tests {
		if got := EventLabel(tt.event); got != tt.expected {
			t.Errorf("EventLabel(%s) = %q, want %q", tt.event, got, tt.expected)
		}
	}
}

func TestTransactionAuthChallengeThenSuccess(t *testing.T) {
	txn := NewTransaction(nil, nil)
	txn.HandleEvent(EventSendInvite)
	txn.HandleEvent(EventRecv401)
	if txn.State() != StateCalling {
		t.Fatalf("expected Calling after 401 retry, got %s", txn.State())
	}
	txn.HandleEvent(EventRecv1xx)
	if txn.State() != StateProceeding {
		t.Fatalf("expected Proceeding, got %s", txn.State())
	}
	txn.HandleEvent(EventRecv2xx)
	if txn.State() != StateTerminated {
		t.Fatalf("expected Terminated, got %s", txn.State())
	}
}
