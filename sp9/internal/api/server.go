package api

import (
	"encoding/json"
	"fmt"
	"lisp-mapserver/internal/mapping"
	"net"
	"net/http"
	"strconv"
	"time"
)

type Server struct {
	store *mapping.Store
	mux   *http.ServeMux
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type StatsResponse struct {
	TotalETRs       int `json:"total_etrs"`
	OnlineETRs      int `json:"online_etrs"`
	GracePeriodETRs int `json:"grace_period_etrs"`
	OfflineETRs     int `json:"offline_etrs"`
	TotalMappings   int `json:"total_mappings"`
}

func NewServer(store *mapping.Store) *Server {
	s := &Server{
		store: store,
		mux:   http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return s.mux
}

func (s *Server) routes() {
	s.mux.HandleFunc("/api/etrs", s.handleETRs)
	s.mux.HandleFunc("/api/etrs/", s.handleETRDetail)
	s.mux.HandleFunc("/api/mappings", s.handleMappings)
	s.mux.HandleFunc("/api/mappings/", s.handleMappingLookup)
	s.mux.HandleFunc("/api/stats", s.handleStats)
	s.mux.HandleFunc("/api/stats/heartbeat", s.handleHeartbeatStats)
	s.mux.HandleFunc("/api/stats/export", s.handleStatsExport)
	s.mux.HandleFunc("/api/register", s.handleRegister)
	s.mux.HandleFunc("/api/heartbeat", s.handleHeartbeat)
	s.mux.HandleFunc("/api/map-request", s.handleMapRequest)
}

func (s *Server) handleETRs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	etrs := s.store.GetALLETRs()
	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: etrs})
}

func (s *Server) handleETRDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	etrAddr := r.URL.Path[len("/api/etrs/"):]
	if etrAddr == "" {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "etr address required"})
		return
	}

	etr, exists := s.store.GetETR(etrAddr)
	if !exists {
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "etr not found"})
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: etr})
}

func (s *Server) handleMappings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	mappings := s.store.GetAllMappings()
	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: mappings})
}

func (s *Server) handleMappingLookup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	eid := r.URL.Path[len("/api/mappings/"):]
	if eid == "" {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "eid required"})
		return
	}

	entry, exists := s.store.Lookup(eid)
	if !exists {
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "mapping not found"})
		return
	}

	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: entry})
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	etrs := s.store.GetALLETRs()
	mappings := s.store.GetAllMappings()

	online := 0
	grace := 0
	offline := 0
	for _, etr := range etrs {
		if etr.InGracePeriod {
			grace++
		} else if etr.Online {
			online++
		} else {
			offline++
		}
	}

	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: StatsResponse{
		TotalETRs:       len(etrs),
		OnlineETRs:      online,
		GracePeriodETRs: grace,
		OfflineETRs:     offline,
		TotalMappings:   len(mappings),
	}})
}

type RegisterRequest struct {
	EID       string        `json:"eid"`
	PrefixLen int           `json:"prefix_len"`
	ETRAddr   string        `json:"etr_addr"`
	TTL       int           `json:"ttl"`
	RLOCs     []RLOCRequest `json:"rlocs"`
}

type RLOCRequest struct {
	Address  string `json:"address"`
	Priority int    `json:"priority"`
	Weight   int    `json:"weight"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "invalid json"})
		return
	}

	if req.EID == "" || req.ETRAddr == "" {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "eid and etr_addr required"})
		return
	}

	if req.TTL <= 0 {
		req.TTL = 60
	}

	rlocs := make([]mapping.RLOC, 0, len(req.RLOCs))
	for _, r := range req.RLOCs {
		rlocs = append(rlocs, mapping.RLOC{
			Address:  parseIP(r.Address),
			Priority: r.Priority,
			Weight:   r.Weight,
		})
	}

	s.store.Register(req.EID, req.PrefixLen, rlocs, req.ETRAddr, req.TTL)
	s.store.UpdateETRHeartbeat(req.ETRAddr)

	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: map[string]string{"status": "registered"}})
}

type HeartbeatRequest struct {
	ETRAddr string `json:"etr_addr"`
}

func (s *Server) handleHeartbeat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	var req HeartbeatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "invalid json"})
		return
	}

	if req.ETRAddr == "" {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "etr_addr required"})
		return
	}

	s.store.UpdateETRHeartbeat(req.ETRAddr)
	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: map[string]string{"status": "acknowledged"}})
}

func (s *Server) handleSimulateOffline(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	etrAddr := r.URL.Query().Get("etr_addr")
	if etrAddr == "" {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "etr_addr required"})
		return
	}

	s.store.SetETROffline(etrAddr)
	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: map[string]string{"status": "offline"}})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func parseIP(s string) net.IP {
	if s == "" {
		return nil
	}
	return net.ParseIP(s)
}

func parseInt(s string, def int) int {
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}

func (s *Server) handleHeartbeatStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	stats := s.store.GetHeartbeatStats()
	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: stats})
}

func (s *Server) handleStatsExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	stats := s.store.GetHeartbeatStats()
	etrs := s.store.GetALLETRs()
	mappings := s.store.GetAllMappings()

	type ExportData struct {
		HeartbeatStats interface{} `json:"heartbeat_stats"`
		ETRs           interface{} `json:"etrs"`
		Mappings       interface{} `json:"mappings"`
		GeneratedAt    string      `json:"generated_at"`
	}

	export := ExportData{
		HeartbeatStats: stats,
		ETRs:           etrs,
		Mappings:       mappings,
		GeneratedAt:    time.Now().Format(time.RFC3339),
	}

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=lisp-mapserver-stats.csv")
		w.WriteHeader(http.StatusOK)

		csv := "Heartbeat Statistics\n"
		csv += "Metric,Value\n"
		csv += fmt.Sprintf("Total Grace Period Entries,%d\n", stats.TotalGracePeriodEntries)
		csv += fmt.Sprintf("Total Recoveries,%d\n", stats.TotalRecoveries)
		csv += fmt.Sprintf("Total Grace Expirations,%d\n", stats.TotalGraceExpirations)
		csv += fmt.Sprintf("Total Offline Transitions,%d\n", stats.TotalOfflineTransitions)
		csv += fmt.Sprintf("Total Heartbeats Received,%d\n", stats.TotalHeartbeatsReceived)
		csv += fmt.Sprintf("Total Map Registers,%d\n", stats.TotalMapRegisters)
		csv += fmt.Sprintf("Total Proxy Replies,%d\n", stats.TotalProxyReplies)
		csv += fmt.Sprintf("Average Recovery Time (ms),%d\n", stats.AvgRecoveryTimeMs)
		csv += fmt.Sprintf("Min Recovery Time (ms),%d\n", stats.MinRecoveryTimeMs)
		csv += fmt.Sprintf("Max Recovery Time (ms),%d\n", stats.MaxRecoveryTimeMs)
		csv += "\nETR Status\n"
		csv += "ETR Address,Online,In Grace Period,Last Heartbeat,Offline Duration\n"
		for _, etr := range etrs {
			csv += fmt.Sprintf("%s,%t,%t,%s,%s\n",
				etr.ETRAddr, etr.Online, etr.InGracePeriod,
				etr.LastHeartbeat.Format(time.RFC3339),
				etr.OfflineDuration)
		}
		csv += "\nEID-to-RLOC Mappings\n"
		csv += "EID,Prefix Length,ETR Address,TTL,RLOC Count\n"
		for _, m := range mappings {
			csv += fmt.Sprintf("%s,%d,%s,%d,%d\n",
				m.EID, m.PrefixLen, m.ETRAddr, m.TTL, len(m.RLOCs))
		}
		w.Write([]byte(csv))
	} else {
		w.Header().Set("Content-Disposition", "attachment; filename=lisp-mapserver-stats.json")
		writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: export})
	}
}

type MapRequestHTTPRequest struct {
	EID       string `json:"eid"`
	PrefixLen int    `json:"prefix_len"`
	SourceEID string `json:"source_eid,omitempty"`
}

func (s *Server) handleMapRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Error: "method not allowed"})
		return
	}

	eid := r.URL.Query().Get("eid")
	if eid == "" {
		writeJSON(w, http.StatusBadRequest, APIResponse{Error: "eid required"})
		return
	}

	entry, exists := s.store.Lookup(eid)
	if !exists {
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "mapping not found"})
		return
	}

	etr, etrExists := s.store.GetETR(entry.ETRAddr)
	if !etrExists {
		writeJSON(w, http.StatusNotFound, APIResponse{Error: "etr not found"})
		return
	}

	type RLOCResp struct {
		Address  string `json:"address"`
		Priority int    `json:"priority"`
		Weight   int    `json:"weight"`
	}

	type ProxyReplyResponse struct {
		EID          string     `json:"eid"`
		PrefixLen    int        `json:"prefix_len"`
		RLOCs        []RLOCResp `json:"rlocs"`
		TTL          int        `json:"ttl"`
		ETRAddr      string     `json:"etr_addr"`
		ETROnline    bool       `json:"etr_online"`
		ETRGrace     bool       `json:"etr_in_grace_period"`
		ProxyReplied bool       `json:"proxy_replied"`
	}

	rlocResps := make([]RLOCResp, len(entry.RLOCs))
	for i, r := range entry.RLOCs {
		rlocResps[i] = RLOCResp{
			Address:  r.Address.String(),
			Priority: r.Priority,
			Weight:   r.Weight,
		}
	}

	proxyReplied := etr.Online || etr.InGracePeriod

	resp := ProxyReplyResponse{
		EID:          entry.EID,
		PrefixLen:    entry.PrefixLen,
		RLOCs:        rlocResps,
		TTL:          entry.TTL,
		ETRAddr:      entry.ETRAddr,
		ETROnline:    etr.Online,
		ETRGrace:     etr.InGracePeriod,
		ProxyReplied: proxyReplied,
	}

	if proxyReplied {
		s.store.IncrementProxyReplies()
	}

	writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: resp})
}
