package main

import (
	"sync"
	"time"
)

type SIPState string

const (
	StateIdle       SIPState = "Idle"
	StateCalling    SIPState = "Calling"
	StateProceeding SIPState = "Proceeding"
	StateCompleted  SIPState = "Completed"
	StateTerminated SIPState = "Terminated"
)

type SIPEvent string

const (
	EventSendInvite    SIPEvent = "send_invite"
	EventRecv1xx       SIPEvent = "recv_1xx"
	EventRecv2xx       SIPEvent = "recv_2xx"
	EventRecv3xx6xx    SIPEvent = "recv_3xx_6xx"
	EventRecv401       SIPEvent = "recv_401"
	EventRecv407       SIPEvent = "recv_407"
	EventTimerB        SIPEvent = "timer_b"
	EventTimerD        SIPEvent = "timer_d"
	EventAckSent       SIPEvent = "ack_sent"
	EventCancelSent    SIPEvent = "cancel_sent"
	EventInviteAuth    SIPEvent = "invite_auth"
	EventInvitePrxAuth SIPEvent = "invite_prx_auth"
)

type Transition struct {
	From  SIPState
	Event SIPEvent
	To    SIPState
}

var transitions = []Transition{
	{StateIdle, EventSendInvite, StateCalling},
	{StateCalling, EventRecv1xx, StateProceeding},
	{StateCalling, EventRecv2xx, StateTerminated},
	{StateCalling, EventRecv3xx6xx, StateTerminated},
	{StateCalling, EventRecv401, StateCalling},
	{StateCalling, EventRecv407, StateCalling},
	{StateCalling, EventTimerB, StateTerminated},
	{StateProceeding, EventRecv1xx, StateProceeding},
	{StateProceeding, EventRecv2xx, StateTerminated},
	{StateProceeding, EventRecv3xx6xx, StateTerminated},
	{StateProceeding, EventRecv401, StateCalling},
	{StateProceeding, EventRecv407, StateCalling},
	{StateCompleted, EventTimerD, StateTerminated},
	{StateCompleted, EventAckSent, StateCompleted},
}

type StateChangeHandler func(from SIPState, to SIPState, event SIPEvent, timestamp int64)
type AutoMessageHandler func(event SIPEvent, message string, timestamp int64)

type StateLogEntry struct {
	From      SIPState `json:"from"`
	To        SIPState `json:"to"`
	Event     SIPEvent `json:"event"`
	Timestamp int64    `json:"timestamp"`
}

type Transaction struct {
	state              SIPState
	handler            StateChangeHandler
	autoMessageHandler AutoMessageHandler
	mu                 chan struct{}
	stateLog           []StateLogEntry
	logMu              sync.Mutex
	authRetryCount     int
	maxAuthRetries     int
}

func NewTransaction(handler StateChangeHandler, autoHandler AutoMessageHandler) *Transaction {
	t := &Transaction{
		state:              StateIdle,
		handler:            handler,
		autoMessageHandler: autoHandler,
		mu:                 make(chan struct{}, 1),
		stateLog:           make([]StateLogEntry, 0),
		maxAuthRetries:     3,
	}
	t.mu <- struct{}{}
	return t
}

func (t *Transaction) lock() {
	<-t.mu
}

func (t *Transaction) unlock() {
	t.mu <- struct{}{}
}

func (t *Transaction) State() SIPState {
	t.lock()
	defer t.unlock()
	return t.state
}

func (t *Transaction) HandleEvent(event SIPEvent) (SIPState, SIPState, bool) {
	t.lock()
	defer t.unlock()

	from := t.state

	for _, tr := range transitions {
		if tr.From == t.state && tr.Event == event {
			to := tr.To

			if (event == EventRecv401 || event == EventRecv407) && t.authRetryCount >= t.maxAuthRetries {
				to = StateTerminated
			}

			t.state = to
			now := time.Now().UnixMilli()

			entry := StateLogEntry{
				From:      from,
				To:        to,
				Event:     event,
				Timestamp: now,
			}
			t.logMu.Lock()
			t.stateLog = append(t.stateLog, entry)
			t.logMu.Unlock()

			if t.handler != nil {
				t.handler(from, to, event, now)
			}

			if t.autoMessageHandler != nil {
				switch event {
				case EventRecv3xx6xx:
					ackMsg := t.SIPMessageForEvent(EventAckSent)
					t.autoMessageHandler(EventAckSent, ackMsg, now)
				case EventTimerB:
					cancelMsg := t.SIPMessageForEvent(EventCancelSent)
					t.autoMessageHandler(EventCancelSent, cancelMsg, now)
				case EventRecv401:
					if t.authRetryCount <= t.maxAuthRetries {
						authMsg := t.SIPMessageForEvent(EventInviteAuth)
						t.autoMessageHandler(EventInviteAuth, authMsg, now)
					}
				case EventRecv407:
					if t.authRetryCount <= t.maxAuthRetries {
						prxAuthMsg := t.SIPMessageForEvent(EventInvitePrxAuth)
						t.autoMessageHandler(EventInvitePrxAuth, prxAuthMsg, now)
					}
				}
			}

			if event == EventRecv401 || event == EventRecv407 {
				if t.authRetryCount < t.maxAuthRetries {
					t.authRetryCount++
				}
			}

			return from, to, true
		}
	}

	return from, from, false
}

func (t *Transaction) ValidEvents() []SIPEvent {
	t.lock()
	defer t.unlock()

	var events []SIPEvent
	for _, tr := range transitions {
		if tr.From == t.state {
			events = append(events, tr.Event)
		}
	}
	return events
}

func (t *Transaction) Reset() {
	t.lock()
	defer t.unlock()
	t.state = StateIdle
	t.authRetryCount = 0
}

func (t *Transaction) GetStateLog() []StateLogEntry {
	t.logMu.Lock()
	defer t.logMu.Unlock()
	result := make([]StateLogEntry, len(t.stateLog))
	copy(result, t.stateLog)
	return result
}

func (t *Transaction) ClearStateLog() {
	t.logMu.Lock()
	defer t.logMu.Unlock()
	t.stateLog = make([]StateLogEntry, 0)
}

func (t *Transaction) SIPMessageForEvent(event SIPEvent) string {
	switch event {
	case EventSendInvite:
		return "INVITE sip:bob@example.com SIP/2.0\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds\r\n" +
			"Max-Forwards: 70\r\n" +
			"To: Bob <sip:bob@example.com>\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314159 INVITE\r\n" +
			"Contact: <sip:alice@pc33.atlanta.com>\r\n" +
			"Content-Type: application/sdp\r\n" +
			"Content-Length: 0\r\n\r\n"
	case EventRecv1xx:
		return "SIP/2.0 180 Ringing\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds;received=192.0.2.1\r\n" +
			"To: Bob <sip:bob@example.com>;tag=a6c85cf\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314159 INVITE\r\n" +
			"Contact: <sip:bob@192.0.2.4>\r\n" +
			"Content-Length: 0\r\n\r\n"
	case EventRecv2xx:
		return "SIP/2.0 200 OK\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds;received=192.0.2.1\r\n" +
			"To: Bob <sip:bob@example.com>;tag=a6c85cf\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314159 INVITE\r\n" +
			"Contact: <sip:bob@192.0.2.4>\r\n" +
			"Content-Type: application/sdp\r\n" +
			"Content-Length: 0\r\n\r\n"
	case EventRecv3xx6xx:
		return "SIP/2.0 486 Busy Here\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds;received=192.0.2.1\r\n" +
			"To: Bob <sip:bob@example.com>;tag=a6c85cf\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314159 INVITE\r\n" +
			"Content-Length: 0\r\n\r\n"
	case EventRecv401:
		return "SIP/2.0 401 Unauthorized\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds;received=192.0.2.1\r\n" +
			"To: Bob <sip:bob@example.com>;tag=a6c85cf\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314159 INVITE\r\n" +
			"WWW-Authenticate: Digest realm=\"sip.example.com\", nonce=\"dcd98b7102dd2f0e8b11d0f600bfb0c093\"\r\n" +
			"Content-Length: 0\r\n\r\n"
	case EventRecv407:
		return "SIP/2.0 407 Proxy Authentication Required\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds;received=192.0.2.1\r\n" +
			"To: Bob <sip:bob@example.com>;tag=a6c85cf\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314159 INVITE\r\n" +
			"Proxy-Authenticate: Digest realm=\"sip.example.com\", nonce=\"a6c85cf9b0e2d4a1f3c8e7b6\"\r\n" +
			"Content-Length: 0\r\n\r\n"
	case EventAckSent:
		return "ACK sip:bob@example.com SIP/2.0\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds\r\n" +
			"Max-Forwards: 70\r\n" +
			"To: Bob <sip:bob@example.com>;tag=a6c85cf\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314159 ACK\r\n" +
			"Content-Length: 0\r\n\r\n"
	case EventTimerB:
		return "[Timer B fired - no response received within timeout]"
	case EventTimerD:
		return "[Timer D fired - transaction cleanup]"
	case EventCancelSent:
		return "CANCEL sip:bob@example.com SIP/2.0\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds\r\n" +
			"Max-Forwards: 70\r\n" +
			"To: Bob <sip:bob@example.com>\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314159 CANCEL\r\n" +
			"Content-Length: 0\r\n\r\n"
	case EventInviteAuth:
		return "INVITE sip:bob@example.com SIP/2.0\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds\r\n" +
			"Max-Forwards: 70\r\n" +
			"To: Bob <sip:bob@example.com>\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314160 INVITE\r\n" +
			"Contact: <sip:alice@pc33.atlanta.com>\r\n" +
			"Authorization: Digest username=\"alice\", realm=\"sip.example.com\", nonce=\"dcd98b7102dd2f0e8b11d0f600bfb0c093\", uri=\"sip:bob@example.com\", response=\"6629fae49393a05397450978507c4ef1\"\r\n" +
			"Content-Type: application/sdp\r\n" +
			"Content-Length: 0\r\n\r\n"
	case EventInvitePrxAuth:
		return "INVITE sip:bob@example.com SIP/2.0\r\n" +
			"Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds\r\n" +
			"Max-Forwards: 70\r\n" +
			"To: Bob <sip:bob@example.com>\r\n" +
			"From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n" +
			"Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n" +
			"CSeq: 314161 INVITE\r\n" +
			"Contact: <sip:alice@pc33.atlanta.com>\r\n" +
			"Proxy-Authorization: Digest username=\"alice\", realm=\"sip.example.com\", nonce=\"a6c85cf9b0e2d4a1f3c8e7b6\", uri=\"sip:bob@example.com\", response=\"54bceab8f6e2c0a1e9f3d4b5c6a7e8f9\"\r\n" +
			"Content-Type: application/sdp\r\n" +
			"Content-Length: 0\r\n\r\n"
	default:
		return ""
	}
}

func EventDirection(event SIPEvent) string {
	switch event {
	case EventSendInvite, EventAckSent, EventCancelSent, EventInviteAuth, EventInvitePrxAuth:
		return "send"
	case EventRecv1xx, EventRecv2xx, EventRecv3xx6xx, EventRecv401, EventRecv407:
		return "recv"
	case EventTimerB, EventTimerD:
		return "internal"
	default:
		return "internal"
	}
}

func EventLabel(event SIPEvent) string {
	switch event {
	case EventSendInvite:
		return "INVITE"
	case EventRecv1xx:
		return "1xx (Ringing)"
	case EventRecv2xx:
		return "2xx (OK)"
	case EventRecv3xx6xx:
		return "3xx-6xx (Busy/Redir)"
	case EventRecv401:
		return "401 (Unauthorized)"
	case EventRecv407:
		return "407 (Proxy Auth)"
	case EventTimerB:
		return "Timer B"
	case EventTimerD:
		return "Timer D"
	case EventAckSent:
		return "ACK"
	case EventCancelSent:
		return "CANCEL"
	case EventInviteAuth:
		return "INVITE (+Auth)"
	case EventInvitePrxAuth:
		return "INVITE (+Proxy-Auth)"
	default:
		return string(event)
	}
}
