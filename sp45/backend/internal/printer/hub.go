package printer

import (
	"3d-printer-controller/internal/models"
	"fmt"
	"log"
	"sync"
	"time"
)

type PrinterInstance struct {
	ID              string
	Name            string
	Manager         *PrinterManager
	FirmwareUpgrade *FirmwareUpgrade
}

type MultiPrinterHub struct {
	mu         sync.Mutex
	printers   map[string]*PrinterInstance
	activeID   string
	alertChans map[string]chan *PrintAlert
}

type PrintAlert struct {
	PrinterID string      `json:"printer_id"`
	Type      string      `json:"type"`
	Severity  string      `json:"severity"`
	Message   string      `json:"message"`
	Timestamp int64       `json:"timestamp"`
	Data      interface{} `json:"data,omitempty"`
}

var (
	hubInstance *MultiPrinterHub
	hubOnce     sync.Once
)

func GetMultiPrinterHub() *MultiPrinterHub {
	hubOnce.Do(func() {
		hubInstance = &MultiPrinterHub{
			printers:   make(map[string]*PrinterInstance),
			alertChans: make(map[string]chan *PrintAlert),
		}
		defaultPM := GetPrinterManager()
		hubInstance.printers["default"] = &PrinterInstance{
			ID:              "default",
			Name:            "默认打印机",
			Manager:         defaultPM,
			FirmwareUpgrade: NewFirmwareUpgrade(defaultPM),
		}
		hubInstance.activeID = "default"
	})
	return hubInstance
}

func (h *MultiPrinterHub) AddPrinter(id, name string, connType ConnectionType) (*PrinterInstance, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.printers[id]; exists {
		return nil, fmt.Errorf("printer %s already exists", id)
	}

	sim := NewMarlinSimulator()
	pm := &PrinterManager{
		simulator:       sim,
		connectionType:  connType,
		connected:       true,
		connStatus:      StatusConnected,
		statusListeners: make(map[string]chan *models.PrinterStatus),
		lastHeartbeat:   time.Now(),
		autoReconnect:   true,
	}

	instance := &PrinterInstance{
		ID:              id,
		Name:            name,
		Manager:         pm,
		FirmwareUpgrade: NewFirmwareUpgrade(pm),
	}

	h.printers[id] = instance
	go pm.broadcastStatusLoop()
	go pm.heartbeatLoop()

	log.Printf("Printer added: %s (%s)", name, id)
	return instance, nil
}

func (h *MultiPrinterHub) RemovePrinter(id string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if id == "default" {
		return fmt.Errorf("cannot remove default printer")
	}

	if instance, exists := h.printers[id]; exists {
		instance.Manager.Disconnect()
		delete(h.printers, id)
		if h.activeID == id {
			h.activeID = "default"
		}
		log.Printf("Printer removed: %s", id)
	}
	return nil
}

func (h *MultiPrinterHub) GetPrinter(id string) *PrinterInstance {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.printers[id]
}

func (h *MultiPrinterHub) GetActivePrinter() *PrinterInstance {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.printers[h.activeID]
}

func (h *MultiPrinterHub) SetActivePrinter(id string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.printers[id]; !exists {
		return fmt.Errorf("printer %s not found", id)
	}
	h.activeID = id
	log.Printf("Active printer set to: %s", id)
	return nil
}

func (h *MultiPrinterHub) GetAllPrinters() []map[string]interface{} {
	h.mu.Lock()
	defer h.mu.Unlock()

	var result []map[string]interface{}
	for id, inst := range h.printers {
		state := inst.Manager.GetConnectionState()
		status := inst.Manager.GetStatus()
		result = append(result, map[string]interface{}{
			"id":         id,
			"name":       inst.Name,
			"active":     id == h.activeID,
			"connected":  state.Connected,
			"status":     state.Status,
			"state":      status.State,
			"progress":   status.Progress,
			"nozzleTemp": status.NozzleTemp,
			"bedTemp":    status.BedTemp,
		})
	}
	return result
}

func (h *MultiPrinterHub) GetActiveID() string {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.activeID
}

func (h *MultiPrinterHub) BroadcastAlert(printerID string, alert *PrintAlert) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for _, ch := range h.alertChans {
		select {
		case ch <- alert:
		default:
		}
	}
}

func (h *MultiPrinterHub) AddAlertListener(id string) chan *PrintAlert {
	h.mu.Lock()
	defer h.mu.Unlock()

	ch := make(chan *PrintAlert, 20)
	h.alertChans[id] = ch
	return ch
}

func (h *MultiPrinterHub) RemoveAlertListener(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if ch, ok := h.alertChans[id]; ok {
		close(ch)
		delete(h.alertChans, id)
	}
}
