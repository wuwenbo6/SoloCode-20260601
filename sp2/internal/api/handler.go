package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"netflow-collector/internal/netflow"
	"netflow-collector/internal/store"
	"strconv"
	"time"
)

type API struct {
	store   *store.Store
	tmplMgr *netflow.TemplateManager
	hub     *Hub
}

func NewAPI(s *store.Store, tm *netflow.TemplateManager, h *Hub) *API {
	return &API{
		store:   s,
		tmplMgr: tm,
		hub:     h,
	}
}

func (a *API) RegisterRoutes() {
	http.HandleFunc("/api/stats", a.handleStats)
	http.HandleFunc("/api/observers", a.handleObservers)
	http.HandleFunc("/api/observers/", a.handleObserverDetail)
	http.HandleFunc("/api/ws", a.handleWS)
}

func (a *API) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(a.store.GetStats())
}

func (a *API) handleObservers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(a.store.GetObservers())
}

func (a *API) handleObserverDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	path := r.URL.Path[len("/api/observers/"):]

	sourceIDStr := path
	subPath := ""
	for i := 0; i < len(path); i++ {
		if path[i] == '/' {
			sourceIDStr = path[:i]
			subPath = path[i+1:]
			break
		}
	}

	sourceID, err := strconv.ParseUint(sourceIDStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid source id", http.StatusBadRequest)
		return
	}

	switch subPath {
	case "templates":
		templates := a.tmplMgr.GetTemplatesBySource(uint32(sourceID))
		json.NewEncoder(w).Encode(templates)
	case "templates/export":
		a.exportTemplatesJSON(w, uint32(sourceID))
	case "flows":
		templateID, _ := strconv.ParseUint(r.URL.Query().Get("templateId"), 10, 16)
		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
		if page < 1 {
			page = 1
		}
		if pageSize < 1 {
			pageSize = 20
		}

		flows, total := a.store.GetFlows(uint32(sourceID), uint16(templateID), page, pageSize)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"flows":    flows,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		})
	default:
		obs := a.store.GetObserver(uint32(sourceID))
		if obs == nil {
			http.Error(w, "observer not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(obs)
	}
}

func (a *API) exportTemplatesJSON(w http.ResponseWriter, sourceID uint32) {
	templates := a.tmplMgr.GetTemplatesBySource(sourceID)

	type FieldExport struct {
		Index            int    `json:"index"`
		Type             uint16 `json:"type"`
		TypeName         string `json:"typeName"`
		Length           uint16 `json:"length"`
		IsEnterprise     bool   `json:"isEnterprise,omitempty"`
		EnterpriseNumber uint32 `json:"enterpriseNumber,omitempty"`
	}

	type TemplateExport struct {
		TemplateID  uint16        `json:"templateId"`
		FieldCount  uint16        `json:"fieldCount"`
		Fields      []FieldExport `json:"fields"`
		LastRefresh string        `json:"lastRefresh"`
	}

	export := struct {
		SourceID   uint32           `json:"sourceId"`
		ExportedAt string           `json:"exportedAt"`
		Templates  []TemplateExport `json:"templates"`
	}{
		SourceID:   sourceID,
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		Templates:  make([]TemplateExport, len(templates)),
	}

	for i, t := range templates {
		fields := make([]FieldExport, len(t.Fields))
		for j, f := range t.Fields {
			fields[j] = FieldExport{
				Index:            j + 1,
				Type:             f.Type,
				TypeName:         f.TypeName,
				Length:           f.Length,
				IsEnterprise:     f.IsEnterprise,
				EnterpriseNumber: f.EnterpriseNumber,
			}
		}
		export.Templates[i] = TemplateExport{
			TemplateID:  t.TemplateID,
			FieldCount:  t.FieldCount,
			Fields:      fields,
			LastRefresh: t.LastRefresh.String(),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="templates_source_%d.json"`, sourceID))
	w.Header().Set("Access-Control-Allow-Origin", "*")

	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	encoder.Encode(export)
}

func (a *API) handleWS(w http.ResponseWriter, r *http.Request) {
	ServeWS(a.hub, w, r)
}
