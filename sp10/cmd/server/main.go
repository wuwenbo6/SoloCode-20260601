package main

import (
	"encoding/csv"
	"encoding/json"
	"mpls-l2vpn-simulator/pkg/calibration"
	"mpls-l2vpn-simulator/pkg/lsping"
	"mpls-l2vpn-simulator/pkg/mpls"
	"mpls-l2vpn-simulator/pkg/pw"
	"mpls-l2vpn-simulator/pkg/vpws"
	"net/http"
	"strconv"
	"time"
)

type Server struct {
	pe1 *vpws.PERouter
	pe2 *vpws.PERouter
}

type PWResponse struct {
	ID             uint32 `json:"id"`
	Type           string `json:"type"`
	FECType        string `json:"fec_type"`
	PWID           uint32 `json:"pw_id"`
	AGI            string `json:"agi,omitempty"`
	SAII           string `json:"saii,omitempty"`
	TAII           string `json:"taii,omitempty"`
	LocalLabel     uint32 `json:"local_label"`
	RemoteLabel    uint32 `json:"remote_label"`
	Status         string `json:"status"`
	StatusValue    uint32 `json:"status_value"`
	MTU            uint16 `json:"mtu"`
	ControlWord    bool   `json:"control_word"`
	VCCVEnabled    bool   `json:"vccv_enabled"`
	LocalEndpoint  string `json:"local_endpoint"`
	RemoteEndpoint string `json:"remote_endpoint"`
}

type PingResultResponse struct {
	Success        bool   `json:"success"`
	SequenceNumber uint32 `json:"sequence_number"`
	RTT            int64  `json:"rtt_ms"`
	RTTString      string `json:"rtt_string"`
	ReturnCode     uint8  `json:"return_code"`
	ReturnSubcode  uint8  `json:"return_subcode"`
	Error          string `json:"error,omitempty"`
	FECType        string `json:"fec_type"`
}

type PingRequest struct {
	Count int `json:"count"`
}

type PWCreateRequest struct {
	PWID        uint32 `json:"pw_id"`
	LocalLabel  uint32 `json:"local_label"`
	RemoteLabel uint32 `json:"remote_label"`
	FECType     string `json:"fec_type"`
	AGI         string `json:"agi,omitempty"`
	SAII        string `json:"saii,omitempty"`
	TAII        string `json:"taii,omitempty"`
}

func NewServer() *Server {
	pe1 := vpws.NewPERouter("PE1")
	pe2 := vpws.NewPERouter("PE2")

	pe1.RemotePE = pe2
	pe2.RemotePE = pe1

	pe1.CreateVPWS(1, 1001, 2001)
	pe2.CreateVPWS(1, 2001, 1001)

	pe1.SetPWStatus(1, pw.PWStatusUp)
	pe2.SetPWStatus(1, pw.PWStatusUp)

	pe1.CreateVPWS(2, 1002, 2002)
	pe2.CreateVPWS(2, 2002, 1002)

	pe1.CreateVPWSFEC129(3, 1003, 2003,
		[]byte("vpn-agi-001"),
		[]byte("pe1-ac1"),
		[]byte("pe2-ac1"),
	)
	pe2.CreateVPWSFEC129(3, 2003, 1003,
		[]byte("vpn-agi-001"),
		[]byte("pe2-ac1"),
		[]byte("pe1-ac1"),
	)

	pe1.SetPWStatus(3, pw.PWStatusUp)
	pe2.SetPWStatus(3, pw.PWStatusUp)

	return &Server{
		pe1: pe1,
		pe2: pe2,
	}
}

func (s *Server) listPWs(w http.ResponseWriter, r *http.Request) {
	pws := s.pe1.ListPWs()

	response := make([]PWResponse, 0, len(pws))
	for _, p := range pws {
		response = append(response, convertPWResponse(p))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) createPW(w http.ResponseWriter, r *http.Request) {
	var req PWCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.FECType == "FEC129" {
		agi := []byte(req.AGI)
		saii := []byte(req.SAII)
		taii := []byte(req.TAII)
		if len(agi) == 0 {
			agi = []byte("default-agi")
		}
		if len(saii) == 0 {
			saii = []byte("pe1-ac")
		}
		if len(taii) == 0 {
			taii = []byte("pe2-ac")
		}
		s.pe1.CreateVPWSFEC129(req.PWID, mpls.Label(req.LocalLabel), mpls.Label(req.RemoteLabel), agi, saii, taii)
		s.pe2.CreateVPWSFEC129(req.PWID, mpls.Label(req.RemoteLabel), mpls.Label(req.LocalLabel), agi, taii, saii)
	} else {
		s.pe1.CreateVPWS(req.PWID, mpls.Label(req.LocalLabel), mpls.Label(req.RemoteLabel))
		s.pe2.CreateVPWS(req.PWID, mpls.Label(req.RemoteLabel), mpls.Label(req.LocalLabel))
	}

	s.pe1.SetPWStatus(req.PWID, pw.PWStatusUp)
	s.pe2.SetPWStatus(req.PWID, pw.PWStatusUp)

	w.WriteHeader(http.StatusCreated)
}

func (s *Server) getPW(w http.ResponseWriter, r *http.Request) {
	pwIDStr := r.PathValue("id")
	pwID, err := strconv.ParseUint(pwIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid PW ID", http.StatusBadRequest)
		return
	}

	p, ok := s.pe1.GetPW(uint32(pwID))
	if !ok {
		http.Error(w, "PW not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(convertPWResponse(p))
}

func (s *Server) togglePWStatus(w http.ResponseWriter, r *http.Request) {
	pwIDStr := r.PathValue("id")
	pwID, err := strconv.ParseUint(pwIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid PW ID", http.StatusBadRequest)
		return
	}

	p, ok := s.pe1.GetPW(uint32(pwID))
	if !ok {
		http.Error(w, "PW not found", http.StatusNotFound)
		return
	}

	var newStatus pw.PWStatus
	if p.IsUp() {
		newStatus = pw.PWStatusDown
	} else {
		newStatus = pw.PWStatusUp
	}

	s.pe1.SetPWStatus(uint32(pwID), newStatus)
	s.pe2.SetPWStatus(uint32(pwID), newStatus)

	p, _ = s.pe1.GetPW(uint32(pwID))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(convertPWResponse(p))
}

func (s *Server) pingPW(w http.ResponseWriter, r *http.Request) {
	pwIDStr := r.PathValue("id")
	pwID, err := strconv.ParseUint(pwIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid PW ID", http.StatusBadRequest)
		return
	}

	var req PingRequest
	req.Count = 4
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&req)
	}
	if req.Count <= 0 {
		req.Count = 4
	}

	results, err := s.pe1.SendLSPPing(uint32(pwID), req.Count)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if results == nil {
		http.Error(w, "PW not found", http.StatusNotFound)
		return
	}

	response := make([]PingResultResponse, 0, len(results))
	for _, res := range results {
		response = append(response, convertPingResult(res))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) getPingResults(w http.ResponseWriter, r *http.Request) {
	pwIDStr := r.PathValue("id")
	pwID, err := strconv.ParseUint(pwIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid PW ID", http.StatusBadRequest)
		return
	}

	results := s.pe1.GetPingResults(uint32(pwID))
	if results == nil {
		results = make([]lsping.LSPPingResult, 0)
	}

	response := make([]PingResultResponse, 0, len(results))
	for _, res := range results {
		response = append(response, convertPingResult(res))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) clearPingResults(w http.ResponseWriter, r *http.Request) {
	pwIDStr := r.PathValue("id")
	pwID, err := strconv.ParseUint(pwIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid PW ID", http.StatusBadRequest)
		return
	}

	s.pe1.ClearPingResults(uint32(pwID))
	w.WriteHeader(http.StatusOK)
}

func (s *Server) getCalProfile(w http.ResponseWriter, r *http.Request) {
	pwIDStr := r.PathValue("id")
	pwID, err := strconv.ParseUint(pwIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid PW ID", http.StatusBadRequest)
		return
	}

	profile, ok := s.pe1.GetCalProfile(uint32(pwID))
	if !ok {
		http.Error(w, "Calibration profile not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func (s *Server) updateCalProfile(w http.ResponseWriter, r *http.Request) {
	pwIDStr := r.PathValue("id")
	pwID, err := strconv.ParseUint(pwIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid PW ID", http.StatusBadRequest)
		return
	}

	profile, ok := s.pe1.GetCalProfile(uint32(pwID))
	if !ok {
		http.Error(w, "Calibration profile not found", http.StatusNotFound)
		return
	}

	var update struct {
		Delay          *calibration.DelayProfile `json:"delay,omitempty"`
		Loss           *calibration.LossProfile  `json:"loss,omitempty"`
		PingIntervalMs *int64                    `json:"ping_interval_ms,omitempty"`
		Name           *string                   `json:"name,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if update.Delay != nil {
		profile.UpdateDelay(*update.Delay)
	}
	if update.Loss != nil {
		profile.UpdateLoss(*update.Loss)
	}
	if update.PingIntervalMs != nil {
		profile.Lock()
		profile.PingIntervalMs = *update.PingIntervalMs
		profile.UpdatedAt = time.Now()
		profile.Unlock()
	}
	if update.Name != nil {
		profile.Lock()
		profile.Name = *update.Name
		profile.UpdatedAt = time.Now()
		profile.Unlock()
	}

	profile, _ = s.pe1.GetCalProfile(uint32(pwID))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func (s *Server) exportCalTable(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	pws := s.pe1.ListPWs()

	type CalTableEntry struct {
		PWID           uint32  `json:"pw_id"`
		FECType        string  `json:"fec_type"`
		ProfileName    string  `json:"profile_name"`
		DelayBaseMs    int64   `json:"delay_base_ms"`
		DelaySwingMs   int64   `json:"delay_swing_ms"`
		DelayMode      string  `json:"delay_mode"`
		JitterMs       int64   `json:"jitter_ms"`
		LossEnabled    bool    `json:"loss_enabled"`
		LossRate       float64 `json:"loss_rate"`
		LossBurstSize  int     `json:"loss_burst_size"`
		PingIntervalMs int64   `json:"ping_interval_ms"`
		UpdatedAt      string  `json:"updated_at"`
	}

	entries := make([]CalTableEntry, 0, len(pws))
	for _, p := range pws {
		profile, ok := s.pe1.GetCalProfile(p.ID)
		if !ok {
			continue
		}

		fecTypeStr := "FEC128"
		if p.FECType == pw.FECType129 {
			fecTypeStr = "FEC129"
		}

		profile.Lock()
		entry := CalTableEntry{
			PWID:           p.ID,
			FECType:        fecTypeStr,
			ProfileName:    profile.Name,
			DelayBaseMs:    profile.Delay.BaseMs,
			DelaySwingMs:   profile.Delay.SwingMs,
			DelayMode:      string(profile.Delay.Mode),
			JitterMs:       profile.Delay.JitterMs,
			LossEnabled:    profile.Loss.Enabled,
			LossRate:       profile.Loss.Rate,
			LossBurstSize:  profile.Loss.BurstSize,
			PingIntervalMs: profile.PingIntervalMs,
			UpdatedAt:      profile.UpdatedAt.Format(time.RFC3339),
		}
		profile.Unlock()

		entries = append(entries, entry)
	}

	switch format {
	case "csv":
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=calibration_table.csv")
		w.Write([]byte{0xEF, 0xBB, 0xBF})

		cw := csv.NewWriter(w)
		cw.Write([]string{"PW ID", "FEC Type", "Profile Name", "Delay Base(ms)", "Delay Swing(ms)", "Delay Mode", "Jitter(ms)", "Loss Enabled", "Loss Rate", "Loss Burst", "Ping Interval(ms)", "Updated At"})
		for _, e := range entries {
			cw.Write([]string{
				strconv.FormatUint(uint64(e.PWID), 10),
				e.FECType,
				e.ProfileName,
				strconv.FormatInt(e.DelayBaseMs, 10),
				strconv.FormatInt(e.DelaySwingMs, 10),
				e.DelayMode,
				strconv.FormatInt(e.JitterMs, 10),
				strconv.FormatBool(e.LossEnabled),
				strconv.FormatFloat(e.LossRate, 'f', 4, 64),
				strconv.FormatInt(int64(e.LossBurstSize), 10),
				strconv.FormatInt(e.PingIntervalMs, 10),
				e.UpdatedAt,
			})
		}
		cw.Flush()

	default:
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", "attachment; filename=calibration_table.json")
		json.NewEncoder(w).Encode(entries)
	}
}

func convertPWResponse(p *pw.Pseudowire) PWResponse {
	status := "DOWN"
	if p.IsUp() {
		status = "UP"
	}

	fecTypeStr := "FEC128"
	if p.FECType == pw.FECType129 {
		fecTypeStr = "FEC129"
	}

	resp := PWResponse{
		ID:             p.ID,
		Type:           "Ethernet",
		FECType:        fecTypeStr,
		PWID:           p.ID,
		LocalLabel:     uint32(p.LocalLabel),
		RemoteLabel:    uint32(p.RemoteLabel),
		Status:         status,
		StatusValue:    uint32(p.Status),
		MTU:            p.MTU,
		ControlWord:    p.ControlWord,
		VCCVEnabled:    p.VCCVEnabled,
		LocalEndpoint:  p.LocalEndpoint,
		RemoteEndpoint: p.RemoteEndpoint,
	}

	if p.FECType == pw.FECType129 {
		resp.AGI = string(p.AGI)
		resp.SAII = string(p.SAII)
		resp.TAII = string(p.TAII)
	}

	return resp
}

func convertPingResult(r lsping.LSPPingResult) PingResultResponse {
	rttMs := r.RTT.Milliseconds()
	rttStr := r.RTT.String()

	return PingResultResponse{
		Success:        r.Success,
		SequenceNumber: r.SequenceNumber,
		RTT:            rttMs,
		RTTString:      rttStr,
		ReturnCode:     r.ReturnCode,
		ReturnSubcode:  r.ReturnSubcode,
		Error:          r.Error,
		FECType:        r.FECType,
	}
}

func main() {
	server := NewServer()

	mux := http.NewServeMux()

	fs := http.FileServer(http.Dir("./web"))
	mux.Handle("/", fs)

	mux.HandleFunc("GET /api/pws", server.listPWs)
	mux.HandleFunc("POST /api/pws", server.createPW)
	mux.HandleFunc("GET /api/pws/{id}", server.getPW)
	mux.HandleFunc("POST /api/pws/{id}/toggle", server.togglePWStatus)
	mux.HandleFunc("POST /api/pws/{id}/ping", server.pingPW)
	mux.HandleFunc("GET /api/pws/{id}/ping-results", server.getPingResults)
	mux.HandleFunc("DELETE /api/pws/{id}/ping-results", server.clearPingResults)
	mux.HandleFunc("GET /api/pws/{id}/calibration", server.getCalProfile)
	mux.HandleFunc("PUT /api/pws/{id}/calibration", server.updateCalProfile)
	mux.HandleFunc("GET /api/calibration/export", server.exportCalTable)

	srv := &http.Server{
		Addr:         ":8080",
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	println("MPLS L2VPN Simulator Server starting on :8080")
	println("Web UI available at: http://localhost:8080/")
	srv.ListenAndServe()
}
