package netflow

import (
	"fmt"
	"sync"
	"time"
)

type TemplateKey struct {
	SourceID   uint32
	TemplateID uint16
}

type Template struct {
	TemplateID  uint16     `json:"templateId"`
	FieldCount  uint16     `json:"fieldCount"`
	Fields      []FieldDef `json:"fields"`
	LastRefresh time.Time  `json:"lastRefresh"`
}

type FieldDef struct {
	Type             uint16 `json:"type"`
	TypeName         string `json:"typeName"`
	Length           uint16 `json:"length"`
	IsEnterprise     bool   `json:"isEnterprise"`
	EnterpriseNumber uint32 `json:"enterpriseNumber,omitempty"`
}

type TemplateAction int

const (
	TemplateNew TemplateAction = iota
	TemplateRefresh
	TemplateRejected
)

type TemplateResult struct {
	Template     *Template
	Action       TemplateAction
	RejectReason string
}

func (r *TemplateResult) IsRejected() bool {
	return r.Action == TemplateRejected
}

func (r *TemplateResult) IsRefresh() bool {
	return r.Action == TemplateRefresh
}

func (r *TemplateResult) IsNew() bool {
	return r.Action == TemplateNew
}

type TemplateManager struct {
	mu        sync.RWMutex
	templates map[TemplateKey]*Template
}

func NewTemplateManager() *TemplateManager {
	return &TemplateManager{
		templates: make(map[TemplateKey]*Template),
	}
}

func fieldsMatch(a []FieldDef, b []FieldDef) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].Type != b[i].Type || a[i].Length != b[i].Length {
			return false
		}
		if a[i].IsEnterprise != b[i].IsEnterprise {
			return false
		}
		if a[i].IsEnterprise && a[i].EnterpriseNumber != b[i].EnterpriseNumber {
			return false
		}
	}
	return true
}

func describeMismatch(existing []FieldDef, incoming []FieldDef) string {
	if len(existing) != len(incoming) {
		return fmt.Sprintf("field count mismatch: existing=%d, incoming=%d", len(existing), len(incoming))
	}

	for i := range existing {
		if existing[i].Type != incoming[i].Type || existing[i].Length != incoming[i].Length {
			return fmt.Sprintf("field #%d mismatch: existing={type=%d(%s), length=%d}, incoming={type=%d(%s), length=%d}",
				i+1,
				existing[i].Type, existing[i].TypeName, existing[i].Length,
				incoming[i].Type, GetFieldTypeName(incoming[i].Type), incoming[i].Length,
			)
		}
		if existing[i].IsEnterprise != incoming[i].IsEnterprise {
			return fmt.Sprintf("field #%d enterprise flag mismatch: existing=%v, incoming=%v",
				i+1, existing[i].IsEnterprise, incoming[i].IsEnterprise)
		}
		if existing[i].IsEnterprise && existing[i].EnterpriseNumber != incoming[i].EnterpriseNumber {
			return fmt.Sprintf("field #%d enterprise number mismatch: existing=%d, incoming=%d",
				i+1, existing[i].EnterpriseNumber, incoming[i].EnterpriseNumber)
		}
	}

	return "unknown mismatch"
}

func (tm *TemplateManager) AddOrUpdateTemplate(sourceID uint32, record TemplateRecord) TemplateResult {
	key := TemplateKey{SourceID: sourceID, TemplateID: record.TemplateID}

	fields := make([]FieldDef, len(record.Fields))
	for i, f := range record.Fields {
		fields[i] = FieldDef{
			Type:             f.Type,
			TypeName:         GetFieldTypeName(f.Type),
			Length:           f.Length,
			IsEnterprise:     f.IsEnterprise,
			EnterpriseNumber: f.EnterpriseNumber,
		}
	}

	t := &Template{
		TemplateID:  record.TemplateID,
		FieldCount:  record.FieldCount,
		Fields:      fields,
		LastRefresh: time.Now(),
	}

	tm.mu.Lock()
	defer tm.mu.Unlock()

	existing, exists := tm.templates[key]
	if !exists {
		tm.templates[key] = t
		return TemplateResult{
			Template: t,
			Action:   TemplateNew,
		}
	}

	if fieldsMatch(existing.Fields, fields) {
		existing.LastRefresh = time.Now()
		return TemplateResult{
			Template: existing,
			Action:   TemplateRefresh,
		}
	}

	reason := describeMismatch(existing.Fields, fields)
	return TemplateResult{
		Template:     existing,
		Action:       TemplateRejected,
		RejectReason: fmt.Sprintf("observer=%d template=%d: %s", sourceID, record.TemplateID, reason),
	}
}

func (tm *TemplateManager) GetTemplate(sourceID uint32, templateID uint16) *Template {
	key := TemplateKey{SourceID: sourceID, TemplateID: templateID}

	tm.mu.RLock()
	defer tm.mu.RUnlock()

	if t, ok := tm.templates[key]; ok {
		return t
	}
	return nil
}

func (tm *TemplateManager) GetTemplatesBySource(sourceID uint32) []*Template {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	var result []*Template
	for key, t := range tm.templates {
		if key.SourceID == sourceID {
			result = append(result, t)
		}
	}
	return result
}

func (tm *TemplateManager) Count() int {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	return len(tm.templates)
}
