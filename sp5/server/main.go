package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	maxGracefulWaitMs = 100
)

type IOWindow struct {
	ID            string `json:"id"`
	StartOffsetMs int64  `json:"startOffsetMs"`
	DurationMs    int64  `json:"durationMs"`
}

type SimulatorConfig struct {
	CycleMs              int64      `json:"cycleMs"`
	Windows              []IOWindow `json:"windows"`
	AutoSubmitIntervalMs int64      `json:"autoSubmitIntervalMs"`
}

type Stats struct {
	TotalAttempts int64 `json:"totalAttempts"`
	SuccessCount  int64 `json:"successCount"`
	RejectedCount int64 `json:"rejectedCount"`
}

type IOResult struct {
	ID           string `json:"id"`
	Timestamp    int64  `json:"timestamp"`
	WindowOpen   bool   `json:"windowOpen"`
	Success      bool   `json:"success"`
	ErrorMessage string `json:"errorMessage,omitempty"`
	InFlight     int    `json:"inFlight,omitempty"`
}

type WindowUtilization struct {
	WindowID         string  `json:"windowId"`
	WindowIndex      int     `json:"windowIndex"`
	StartOffsetMs    int64   `json:"startOffsetMs"`
	DurationMs       int64   `json:"durationMs"`
	EndOffsetMs      int64   `json:"endOffsetMs"`
	CycleUtilPct     float64 `json:"cycleUtilPct"`
	EffectiveUtilPct float64 `json:"effectiveUtilPct"`
	IOSuccessCount   int64   `json:"ioSuccessCount"`
	IORejectedCount  int64   `json:"ioRejectedCount"`
}

type UtilizationReport struct {
	Namespace          string              `json:"namespace"`
	CycleMs            int64               `json:"cycleMs"`
	TotalWindowMs      int64               `json:"totalWindowMs"`
	TotalGapMs         int64               `json:"totalGapMs"`
	CycleUtilPct       float64             `json:"cycleUtilPct"`
	EffectiveUtilPct   float64             `json:"effectiveUtilPct"`
	TotalIOSuccess     int64               `json:"totalIoSuccess"`
	TotalIORejected    int64               `json:"totalIoRejected"`
	OverallSuccessRate float64             `json:"overallSuccessRate"`
	Windows            []WindowUtilization `json:"windows"`
	GeneratedAt        int64               `json:"generatedAt"`
}

type NamespaceStatus struct {
	Name               string     `json:"name"`
	Running            bool       `json:"running"`
	CurrentWindowOpen  bool       `json:"currentWindowOpen"`
	NextWindowOpenInMs int64      `json:"nextWindowOpenInMs"`
	CyclePositionMs    int64      `json:"cyclePositionMs"`
	CycleMs            int64      `json:"cycleMs"`
	Stats              Stats      `json:"stats"`
	RecentResults      []IOResult `json:"recentResults"`
	Windows            []IOWindow `json:"windows"`
	InFlight           int        `json:"inFlight"`
	CycleUtilPct       float64    `json:"cycleUtilPct"`
}

type WSMessage struct {
	Type      string      `json:"type"`
	Namespace string      `json:"namespace,omitempty"`
	Payload   interface{} `json:"payload"`
}

type WSClient struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

type Namespace struct {
	name      string
	config    SimulatorConfig
	running   bool
	startTime time.Time
	stats     Stats
	results   []IOResult
	mu        sync.RWMutex
	autoStop  chan struct{}

	inFlight     int64
	inFlightMu   sync.Mutex
	inFlightDone chan struct{}

	closing   bool
	closingMu sync.Mutex
}

type Simulator struct {
	namespaces map[string]*Namespace
	nsMu       sync.RWMutex
	wsClients  map[*WSClient]bool
	wsMu       sync.Mutex
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func NewNamespace(name string) *Namespace {
	return &Namespace{
		name: name,
		config: SimulatorConfig{
			CycleMs: 10000,
			Windows: []IOWindow{
				{ID: uuid.New().String(), StartOffsetMs: 0, DurationMs: 4000},
				{ID: uuid.New().String(), StartOffsetMs: 6000, DurationMs: 3000},
			},
			AutoSubmitIntervalMs: 500,
		},
		autoStop:     make(chan struct{}),
		inFlightDone: make(chan struct{}),
	}
}

func NewSimulator() *Simulator {
	sim := &Simulator{
		namespaces: make(map[string]*Namespace),
		wsClients:  make(map[*WSClient]bool),
	}
	sim.namespaces["ns0"] = NewNamespace("ns0")
	sim.namespaces["ns1"] = NewNamespace("ns1")
	sim.namespaces["ns1"].config.Windows = []IOWindow{
		{ID: uuid.New().String(), StartOffsetMs: 2000, DurationMs: 5000},
		{ID: uuid.New().String(), StartOffsetMs: 8000, DurationMs: 1500},
	}
	return sim
}

func (ns *Namespace) getCyclePosition() int64 {
	if !ns.running {
		return 0
	}
	elapsed := time.Since(ns.startTime).Milliseconds()
	cycleMs := ns.config.CycleMs
	if cycleMs <= 0 {
		cycleMs = 10000
	}
	return elapsed % cycleMs
}

func (ns *Namespace) isInWindow(pos int64) bool {
	for _, w := range ns.config.Windows {
		if pos >= w.StartOffsetMs && pos < w.StartOffsetMs+w.DurationMs {
			return true
		}
	}
	return false
}

func (ns *Namespace) isWindowOpen() bool {
	if !ns.running {
		return false
	}
	pos := ns.getCyclePosition()
	if !ns.isInWindow(pos) {
		return false
	}
	ns.closingMu.Lock()
	closing := ns.closing
	ns.closingMu.Unlock()
	return !closing
}

func (ns *Namespace) getNextWindowOpenIn() int64 {
	if !ns.running {
		return 0
	}
	pos := ns.getCyclePosition()
	cycleMs := ns.config.CycleMs
	var minNext int64 = -1
	for _, w := range ns.config.Windows {
		var nextStart int64
		if w.StartOffsetMs > pos {
			nextStart = w.StartOffsetMs - pos
		} else {
			nextStart = cycleMs - pos + w.StartOffsetMs
		}
		if minNext < 0 || nextStart < minNext {
			minNext = nextStart
		}
	}
	if minNext < 0 {
		minNext = cycleMs - pos
	}
	return minNext
}

func (ns *Namespace) getInFlight() int64 {
	ns.inFlightMu.Lock()
	defer ns.inFlightMu.Unlock()
	return ns.inFlight
}

func (ns *Namespace) incInFlight() {
	ns.inFlightMu.Lock()
	ns.inFlight++
	ns.inFlightMu.Unlock()
}

func (ns *Namespace) decInFlight() {
	ns.inFlightMu.Lock()
	ns.inFlight--
	if ns.inFlight < 0 {
		ns.inFlight = 0
	}
	if ns.inFlight == 0 {
		close(ns.inFlightDone)
		ns.inFlightDone = make(chan struct{})
	}
	ns.inFlightMu.Unlock()
}

func (ns *Namespace) waitInFlightDrained(timeoutMs int64) bool {
	deadline := time.After(time.Duration(timeoutMs) * time.Millisecond)

	for {
		if ns.getInFlight() == 0 {
			return true
		}

		ns.inFlightMu.Lock()
		done := ns.inFlightDone
		ns.inFlightMu.Unlock()

		select {
		case <-done:
			return true
		case <-deadline:
			return false
		}
	}
}

func (ns *Namespace) calcCycleUtilPct() float64 {
	cycleMs := ns.config.CycleMs
	if cycleMs <= 0 {
		return 0
	}
	var totalWindowMs int64
	for _, w := range ns.config.Windows {
		totalWindowMs += w.DurationMs
	}
	return float64(totalWindowMs) / float64(cycleMs) * 100
}

func (ns *Namespace) windowSchedulerLoop(sim *Simulator) {
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	var currentWindowOpen bool
	for {
		select {
		case <-ns.autoStop:
			return
		case <-ticker.C:
			ns.mu.RLock()
			running := ns.running
			ns.mu.RUnlock()
			if !running {
				return
			}

			pos := ns.getCyclePosition()
			wasOpen := currentWindowOpen
			isOpen := ns.isInWindow(pos)

			if wasOpen && !isOpen {
				ns.closingMu.Lock()
				ns.closing = true
				ns.closingMu.Unlock()

				inFlight := ns.getInFlight()
				if inFlight > 0 {
					ns.waitInFlightDrained(maxGracefulWaitMs)
				}

				ns.closingMu.Lock()
				ns.closing = false
				ns.closingMu.Unlock()

				currentWindowOpen = false
				sim.broadcastWS(WSMessage{
					Type:      "window_change",
					Namespace: ns.name,
					Payload:   map[string]bool{"windowOpen": false},
				})
			} else if !wasOpen && isOpen {
				currentWindowOpen = true
				sim.broadcastWS(WSMessage{
					Type:      "window_change",
					Namespace: ns.name,
					Payload:   map[string]bool{"windowOpen": true},
				})
			}

			currentWindowOpen = isOpen
		}
	}
}

func (ns *Namespace) SubmitIO(sim *Simulator) IOResult {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	ns.closingMu.Lock()
	closing := ns.closing
	ns.closingMu.Unlock()

	windowOpen := ns.isWindowOpen() && !closing
	result := IOResult{
		ID:         uuid.New().String(),
		Timestamp:  time.Now().UnixMilli(),
		WindowOpen: windowOpen,
	}

	if windowOpen {
		ns.incInFlight()
		go func() {
			time.Sleep(time.Duration(5+time.Now().UnixNano()%20) * time.Millisecond)
			ns.decInFlight()
		}()

		result.Success = true
		result.InFlight = int(ns.getInFlight())
		ns.stats.TotalAttempts++
		ns.stats.SuccessCount++
	} else {
		if closing {
			result.ErrorMessage = "资源不可用: 窗口关闭中，等待进行中的 IO 完成"
		} else {
			result.ErrorMessage = "资源不可用: 当前不在 IO 窗口内"
		}
		result.Success = false
		ns.stats.TotalAttempts++
		ns.stats.RejectedCount++
	}

	ns.results = append(ns.results, result)
	if len(ns.results) > 500 {
		ns.results = ns.results[len(ns.results)-500:]
	}

	sim.broadcastWS(WSMessage{
		Type:      "io_result",
		Namespace: ns.name,
		Payload:   result,
	})

	return result
}

func (ns *Namespace) Start(sim *Simulator) {
	ns.mu.Lock()
	defer ns.mu.Unlock()
	if ns.running {
		return
	}
	ns.running = true
	ns.startTime = time.Now()
	ns.stats = Stats{}
	ns.results = nil
	ns.autoStop = make(chan struct{})
	ns.inFlight = 0
	ns.closing = false

	go ns.autoSubmitLoop(sim)
	go ns.statusBroadcastLoop(sim)
	go ns.windowSchedulerLoop(sim)
}

func (ns *Namespace) Stop(sim *Simulator) {
	ns.mu.Lock()
	defer ns.mu.Unlock()
	if !ns.running {
		return
	}
	ns.running = false
	close(ns.autoStop)

	sim.broadcastWS(WSMessage{
		Type:      "window_change",
		Namespace: ns.name,
		Payload:   map[string]bool{"windowOpen": false},
	})
}

func (ns *Namespace) autoSubmitLoop(sim *Simulator) {
	ticker := time.NewTicker(time.Duration(ns.config.AutoSubmitIntervalMs) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ns.autoStop:
			return
		case <-ticker.C:
			ns.mu.RLock()
			running := ns.running
			ns.mu.RUnlock()
			if !running {
				return
			}
			ns.SubmitIO(sim)
		}
	}
}

func (ns *Namespace) statusBroadcastLoop(sim *Simulator) {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ns.autoStop:
			return
		case <-ticker.C:
			ns.mu.RLock()
			running := ns.running
			ns.mu.RUnlock()
			if !running {
				return
			}
			status := ns.GetStatus()
			sim.broadcastWS(WSMessage{
				Type:      "status",
				Namespace: ns.name,
				Payload:   status,
			})
		}
	}
}

func (ns *Namespace) GetStatus() NamespaceStatus {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	status := NamespaceStatus{
		Name:               ns.name,
		Running:            ns.running,
		CurrentWindowOpen:  ns.isWindowOpen(),
		NextWindowOpenInMs: ns.getNextWindowOpenIn(),
		CyclePositionMs:    ns.getCyclePosition(),
		CycleMs:            ns.config.CycleMs,
		Stats:              ns.stats,
		Windows:            ns.config.Windows,
		InFlight:           int(ns.getInFlight()),
		CycleUtilPct:       ns.calcCycleUtilPct(),
	}

	recentCount := 20
	if len(ns.results) < recentCount {
		recentCount = len(ns.results)
	}
	status.RecentResults = make([]IOResult, recentCount)
	copy(status.RecentResults, ns.results[len(ns.results)-recentCount:])

	return status
}

func (ns *Namespace) UpdateConfigDynamic(config SimulatorConfig) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	for i := range config.Windows {
		if config.Windows[i].ID == "" {
			config.Windows[i].ID = uuid.New().String()
		}
	}
	if config.CycleMs <= 0 {
		config.CycleMs = 10000
	}
	if config.AutoSubmitIntervalMs <= 0 {
		config.AutoSubmitIntervalMs = 500
	}

	if ns.running {
		oldCycleMs := ns.config.CycleMs
		newCycleMs := config.CycleMs

		if oldCycleMs != newCycleMs {
			elapsed := time.Since(ns.startTime).Milliseconds()
			oldPos := elapsed % oldCycleMs
			newStartOffset := elapsed - oldPos
			ns.startTime = time.Now().Add(-time.Duration(newStartOffset) * time.Millisecond)
		}

		ns.config.CycleMs = config.CycleMs
		ns.config.Windows = config.Windows

		if config.AutoSubmitIntervalMs != ns.config.AutoSubmitIntervalMs {
			ns.config.AutoSubmitIntervalMs = config.AutoSubmitIntervalMs
		}
	} else {
		ns.config = config
	}
}

func (ns *Namespace) UpdateConfig(config SimulatorConfig) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	for i := range config.Windows {
		if config.Windows[i].ID == "" {
			config.Windows[i].ID = uuid.New().String()
		}
	}
	if config.CycleMs <= 0 {
		config.CycleMs = 10000
	}
	if config.AutoSubmitIntervalMs <= 0 {
		config.AutoSubmitIntervalMs = 500
	}

	wasRunning := ns.running
	if wasRunning {
		ns.running = false
		close(ns.autoStop)
	}

	ns.config = config

	if wasRunning {
		ns.running = true
		ns.startTime = time.Now()
		ns.autoStop = make(chan struct{})
		ns.inFlight = 0
		ns.closing = false
	}
}

func (ns *Namespace) GetLogs() []IOResult {
	ns.mu.RLock()
	defer ns.mu.RUnlock()
	result := make([]IOResult, len(ns.results))
	copy(result, ns.results)
	return result
}

func (ns *Namespace) GetUtilizationReport() UtilizationReport {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	cycleMs := ns.config.CycleMs
	windows := ns.config.Windows
	stats := ns.stats

	var totalWindowMs int64
	sortedWindows := make([]IOWindow, len(windows))
	copy(sortedWindows, windows)
	sort.Slice(sortedWindows, func(i, j int) bool {
		return sortedWindows[i].StartOffsetMs < sortedWindows[j].StartOffsetMs
	})

	for _, w := range sortedWindows {
		totalWindowMs += w.DurationMs
	}

	totalGapMs := cycleMs - totalWindowMs
	if totalGapMs < 0 {
		totalGapMs = 0
	}

	cycleUtilPct := float64(totalWindowMs) / float64(cycleMs) * 100
	effectiveUtilPct := float64(0)
	if stats.TotalAttempts > 0 {
		effectiveUtilPct = float64(stats.SuccessCount) / float64(stats.TotalAttempts) * 100
	}

	overallSuccessRate := float64(0)
	if stats.TotalAttempts > 0 {
		overallSuccessRate = float64(stats.SuccessCount) / float64(stats.TotalAttempts) * 100
	}

	windowUtils := make([]WindowUtilization, len(sortedWindows))
	for i, w := range sortedWindows {
		wCyclePct := float64(w.DurationMs) / float64(cycleMs) * 100
		wEffectivePct := float64(0)
		if stats.TotalAttempts > 0 {
			wEffectivePct = float64(stats.SuccessCount) / float64(stats.TotalAttempts) * 100
		}

		windowUtils[i] = WindowUtilization{
			WindowID:         w.ID,
			WindowIndex:      i + 1,
			StartOffsetMs:    w.StartOffsetMs,
			DurationMs:       w.DurationMs,
			EndOffsetMs:      w.StartOffsetMs + w.DurationMs,
			CycleUtilPct:     wCyclePct,
			EffectiveUtilPct: wEffectivePct,
			IOSuccessCount:   stats.SuccessCount,
			IORejectedCount:  stats.RejectedCount,
		}
	}

	return UtilizationReport{
		Namespace:          ns.name,
		CycleMs:            cycleMs,
		TotalWindowMs:      totalWindowMs,
		TotalGapMs:         totalGapMs,
		CycleUtilPct:       cycleUtilPct,
		EffectiveUtilPct:   effectiveUtilPct,
		TotalIOSuccess:     stats.SuccessCount,
		TotalIORejected:    stats.RejectedCount,
		OverallSuccessRate: overallSuccessRate,
		Windows:            windowUtils,
		GeneratedAt:        time.Now().UnixMilli(),
	}
}

func (sim *Simulator) GetNamespace(name string) (*Namespace, bool) {
	sim.nsMu.RLock()
	defer sim.nsMu.RUnlock()
	ns, ok := sim.namespaces[name]
	return ns, ok
}

func (sim *Simulator) GetOrCreateNamespace(name string) *Namespace {
	sim.nsMu.Lock()
	defer sim.nsMu.Unlock()
	if ns, ok := sim.namespaces[name]; ok {
		return ns
	}
	ns := NewNamespace(name)
	sim.namespaces[name] = ns
	return ns
}

func (sim *Simulator) ListNamespaces() []string {
	sim.nsMu.RLock()
	defer sim.nsMu.RUnlock()
	names := make([]string, 0, len(sim.namespaces))
	for name := range sim.namespaces {
		names = append(names, name)
	}
	return names
}

func (sim *Simulator) DeleteNamespace(name string) bool {
	sim.nsMu.Lock()
	defer sim.nsMu.Unlock()
	if _, ok := sim.namespaces[name]; !ok {
		return false
	}
	delete(sim.namespaces, name)
	return true
}

func (sim *Simulator) AddWSClient(conn *websocket.Conn) *WSClient {
	sim.wsMu.Lock()
	defer sim.wsMu.Unlock()
	client := &WSClient{conn: conn}
	sim.wsClients[client] = true
	return client
}

func (sim *Simulator) RemoveWSClient(client *WSClient) {
	sim.wsMu.Lock()
	defer sim.wsMu.Unlock()
	delete(sim.wsClients, client)
}

func (sim *Simulator) broadcastWS(msg WSMessage) {
	sim.wsMu.Lock()
	clients := make([]*WSClient, 0, len(sim.wsClients))
	for c := range sim.wsClients {
		clients = append(clients, c)
	}
	sim.wsMu.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	for _, client := range clients {
		client.mu.Lock()
		err := client.conn.WriteMessage(websocket.TextMessage, data)
		client.mu.Unlock()
		if err != nil {
			client.conn.Close()
			sim.wsMu.Lock()
			delete(sim.wsClients, client)
			sim.wsMu.Unlock()
		}
	}
}

func handleCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func getNamespaceParam(r *http.Request) string {
	ns := r.URL.Query().Get("ns")
	if ns == "" {
		ns = "ns0"
	}
	return ns
}

func writeCSVReport(reports []UtilizationReport) string {
	csv := "namespace,cycle_ms,total_window_ms,total_gap_ms,cycle_util_pct,effective_util_pct,total_io_success,total_io_rejected,overall_success_rate,window_index,window_id,window_start_ms,window_duration_ms,window_end_ms,window_cycle_util_pct\n"
	for _, r := range reports {
		if len(r.Windows) == 0 {
			csv += fmt.Sprintf("%s,%d,%d,%d,%.2f,%.2f,%d,%d,%.2f,,,,,\n",
				r.Namespace, r.CycleMs, r.TotalWindowMs, r.TotalGapMs,
				r.CycleUtilPct, r.EffectiveUtilPct,
				r.TotalIOSuccess, r.TotalIORejected, r.OverallSuccessRate)
		}
		for _, w := range r.Windows {
			csv += fmt.Sprintf("%s,%d,%d,%d,%.2f,%.2f,%d,%d,%.2f,%d,%s,%d,%d,%d,%.2f\n",
				r.Namespace, r.CycleMs, r.TotalWindowMs, r.TotalGapMs,
				r.CycleUtilPct, r.EffectiveUtilPct,
				r.TotalIOSuccess, r.TotalIORejected, r.OverallSuccessRate,
				w.WindowIndex, w.WindowID, w.StartOffsetMs, w.DurationMs, w.EndOffsetMs,
				w.CycleUtilPct)
		}
	}
	return csv
}

func main() {
	sim := NewSimulator()

	http.HandleFunc("/api/namespaces", handleCORS(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(sim.ListNamespaces())
		case http.MethodPost:
			type CreateReq struct {
				Name string `json:"name"`
			}
			var req CreateReq
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			if req.Name == "" {
				http.Error(w, "name is required", http.StatusBadRequest)
				return
			}
			ns := sim.GetOrCreateNamespace(req.Name)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(ns.GetStatus())
		case http.MethodDelete:
			name := getNamespaceParam(r)
			if name == "ns0" {
				http.Error(w, "cannot delete default namespace ns0", http.StatusBadRequest)
				return
			}
			if !sim.DeleteNamespace(name) {
				http.Error(w, "namespace not found", http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	http.HandleFunc("/api/status", handleCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		nsName := getNamespaceParam(r)
		ns, ok := sim.GetNamespace(nsName)
		if !ok {
			http.Error(w, "namespace not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ns.GetStatus())
	}))

	http.HandleFunc("/api/status/all", handleCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		sim.nsMu.RLock()
		statuses := make(map[string]NamespaceStatus)
		for name, ns := range sim.namespaces {
			statuses[name] = ns.GetStatus()
		}
		sim.nsMu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(statuses)
	}))

	http.HandleFunc("/api/config", handleCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		nsName := getNamespaceParam(r)
		ns := sim.GetOrCreateNamespace(nsName)
		var config SimulatorConfig
		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		ns.UpdateConfigDynamic(config)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ns.GetStatus())
	}))

	http.HandleFunc("/api/start", handleCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		nsName := getNamespaceParam(r)
		ns := sim.GetOrCreateNamespace(nsName)
		ns.Start(sim)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"namespace": nsName, "running": true})
	}))

	http.HandleFunc("/api/stop", handleCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		nsName := getNamespaceParam(r)
		ns, ok := sim.GetNamespace(nsName)
		if !ok {
			http.Error(w, "namespace not found", http.StatusNotFound)
			return
		}
		ns.Stop(sim)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"namespace": nsName, "running": false})
	}))

	http.HandleFunc("/api/io/submit", handleCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		nsName := getNamespaceParam(r)
		ns, ok := sim.GetNamespace(nsName)
		if !ok {
			http.Error(w, "namespace not found", http.StatusNotFound)
			return
		}
		result := ns.SubmitIO(sim)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}))

	http.HandleFunc("/api/logs", handleCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		nsName := getNamespaceParam(r)
		ns, ok := sim.GetNamespace(nsName)
		if !ok {
			http.Error(w, "namespace not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ns.GetLogs())
	}))

	http.HandleFunc("/api/report", handleCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		format := r.URL.Query().Get("format")
		nsName := r.URL.Query().Get("ns")

		var reports []UtilizationReport

		if nsName != "" {
			ns, ok := sim.GetNamespace(nsName)
			if !ok {
				http.Error(w, "namespace not found", http.StatusNotFound)
				return
			}
			reports = []UtilizationReport{ns.GetUtilizationReport()}
		} else {
			sim.nsMu.RLock()
			for _, ns := range sim.namespaces {
				reports = append(reports, ns.GetUtilizationReport())
			}
			sim.nsMu.RUnlock()
		}

		if format == "csv" {
			w.Header().Set("Content-Type", "text/csv; charset=utf-8")
			w.Header().Set("Content-Disposition", "attachment; filename=nvme_utilization_report.csv")
			w.Write([]byte("\xEF\xBB\xBF"))
			w.Write([]byte(writeCSVReport(reports)))
		} else {
			w.Header().Set("Content-Type", "application/json")
			if len(reports) == 1 {
				json.NewEncoder(w).Encode(reports[0])
			} else {
				json.NewEncoder(w).Encode(reports)
			}
		}
	}))

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}
		defer conn.Close()

		client := sim.AddWSClient(conn)
		defer sim.RemoveWSClient(client)

		sim.nsMu.RLock()
		for name, ns := range sim.namespaces {
			status := ns.GetStatus()
			data, _ := json.Marshal(WSMessage{Type: "status", Namespace: name, Payload: status})
			client.mu.Lock()
			conn.WriteMessage(websocket.TextMessage, data)
			client.mu.Unlock()
		}
		sim.nsMu.RUnlock()

		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	})

	fmt.Println("NVMe IO Determinism Simulator starting on :8080...")
	fmt.Println("  Namespaces: ns0, ns1 (pre-configured)")
	fmt.Println("  Graceful shutdown window: 100ms")
	fmt.Println("  Dynamic cycle adjustment: enabled")
	fmt.Println("  Report export: /api/report?format=json|csv")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
