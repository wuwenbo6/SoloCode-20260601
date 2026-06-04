package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
)

type APIHandler struct {
	db          *PostgresRepo
	simulator   *SensorSimulator
	threshold   *ThresholdManager
	alertEngine *AlertEngine
}

func NewAPIHandler(db *PostgresRepo, sim *SensorSimulator, tm *ThresholdManager, ae *AlertEngine) *APIHandler {
	return &APIHandler{
		db:          db,
		simulator:   sim,
		threshold:   tm,
		alertEngine: ae,
	}
}

func (h *APIHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/sensors", h.handleSensors)
	mux.HandleFunc("/api/alerts", h.handleAlerts)
	mux.HandleFunc("/api/thresholds", h.handleThresholds)
	mux.HandleFunc("/api/stats", h.handleStats)
	mux.HandleFunc("/api/alerts/acknowledge", h.handleAcknowledge)
}

func (h *APIHandler) handleSensors(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var sensors []SensorInfo
	if h.db != nil {
		dbSensors, err := h.db.GetSensors()
		if err == nil && len(dbSensors) > 0 {
			sensors = dbSensors
		}
	}
	if len(sensors) == 0 {
		sensors = h.simulator.GetSensors()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sensors)
}

func (h *APIHandler) handleAlerts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.db == nil {
		http.Error(w, "database not available", http.StatusServiceUnavailable)
		return
	}

	params := AlertQueryParams{
		SensorID: parseIntOrDefault(r.URL.Query().Get("sensor_id"), 0),
		Level:    r.URL.Query().Get("level"),
		Start:    r.URL.Query().Get("start"),
		End:      r.URL.Query().Get("end"),
		Page:     parseIntOrDefault(r.URL.Query().Get("page"), 1),
		Limit:    parseIntOrDefault(r.URL.Query().Get("limit"), 20),
	}

	records, total, err := h.db.QueryAlerts(params)
	if err != nil {
		log.Printf("failed to query alerts: %v", err)
		http.Error(w, "failed to query alerts", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"alerts": records,
		"total":  total,
		"page":   params.Page,
		"limit":  params.Limit,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *APIHandler) handleThresholds(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		thresholds := h.threshold.GetAll()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(thresholds)

	case http.MethodPut:
		var payload ThresholdPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if err := h.threshold.Set(payload); err != nil {
			log.Printf("failed to set threshold: %v", err)
			http.Error(w, "failed to set threshold", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.db == nil {
		http.Error(w, "database not available", http.StatusServiceUnavailable)
		return
	}

	stats, err := h.db.GetAlertStats()
	if err != nil {
		log.Printf("failed to get stats: %v", err)
		http.Error(w, "failed to get stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *APIHandler) handleAcknowledge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "missing id parameter", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id parameter", http.StatusBadRequest)
		return
	}

	if h.db == nil {
		http.Error(w, "database not available", http.StatusServiceUnavailable)
		return
	}

	if err := h.db.AcknowledgeAlert(id); err != nil {
		log.Printf("failed to acknowledge alert: %v", err)
		http.Error(w, "failed to acknowledge alert", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
