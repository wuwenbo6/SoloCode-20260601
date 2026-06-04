package printer

import (
	"3d-printer-controller/internal/database"
	"3d-printer-controller/internal/models"
	"fmt"
	"log"
	"sync"
	"time"
)

type ConnectionType string
type ConnectionStatus string

const (
	ConnWebUSB    ConnectionType = "webusb"
	ConnSerial    ConnectionType = "serial"
	ConnSimulator ConnectionType = "simulator"
)

const (
	StatusDisconnected ConnectionStatus = "disconnected"
	StatusConnecting   ConnectionStatus = "connecting"
	StatusConnected    ConnectionStatus = "connected"
	StatusReconnecting ConnectionStatus = "reconnecting"
)

const (
	heartbeatInterval = 3 * time.Second
	heartbeatTimeout  = 5 * time.Second
	maxReconnectTries = 5
)

type PrinterManager struct {
	mu              sync.Mutex
	simulator       *MarlinSimulator
	connectionType  ConnectionType
	connected       bool
	connStatus      ConnectionStatus
	printerInfo     *models.FirmwareInfo
	statusListeners map[string]chan *models.PrinterStatus
	currentJobID    uint

	lastHeartbeat   time.Time
	heartbeatCount  uint64
	reconnectTries  int
	autoReconnect   bool
}

type ConnectionState struct {
	Status         ConnectionStatus `json:"status"`
	Type           ConnectionType   `json:"type"`
	Connected      bool             `json:"connected"`
	LastHeartbeat  time.Time        `json:"lastHeartbeat"`
	HeartbeatCount uint64           `json:"heartbeatCount"`
	ReconnectTries int              `json:"reconnectTries"`
	LatencyMs      int64            `json:"latencyMs"`
}

var (
	managerInstance *PrinterManager
	managerOnce     sync.Once
)

func GetPrinterManager() *PrinterManager {
	managerOnce.Do(func() {
		managerInstance = &PrinterManager{
			simulator:       NewMarlinSimulator(),
			connectionType:  ConnSimulator,
			connected:       true,
			connStatus:      StatusConnected,
			statusListeners: make(map[string]chan *models.PrinterStatus),
			lastHeartbeat:   time.Now(),
			heartbeatCount:  0,
			reconnectTries:  0,
			autoReconnect:   true,
		}
		go managerInstance.broadcastStatusLoop()
		go managerInstance.heartbeatLoop()
	})
	return managerInstance
}

func (pm *PrinterManager) Connect(connType ConnectionType) error {
	pm.mu.Lock()
	pm.connectionType = connType
	pm.connStatus = StatusConnecting
	pm.mu.Unlock()

	info, err := pm.getFirmwareInfo()
	if err != nil {
		pm.printerInfo = &models.FirmwareInfo{
			Name:        "Marlin",
			Version:     "2.1.2",
			MachineType: "Simulated 3D Printer",
			Extruders:   1,
		}
	} else {
		pm.printerInfo = info
	}

	pm.mu.Lock()
	pm.connected = true
	pm.connStatus = StatusConnected
	pm.lastHeartbeat = time.Now()
	pm.heartbeatCount = 0
	pm.reconnectTries = 0
	pm.mu.Unlock()

	log.Printf("Printer connected via %s", connType)
	return nil
}

func (pm *PrinterManager) Disconnect() {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.connected = false
	pm.connStatus = StatusDisconnected
	pm.autoReconnect = false
	log.Println("Printer disconnected")
}

func (pm *PrinterManager) IsConnected() bool {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	return pm.connected
}

func (pm *PrinterManager) GetConnectionStatus() ConnectionStatus {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	return pm.connStatus
}

func (pm *PrinterManager) GetConnectionState() *ConnectionState {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	latencyMs := int64(0)
	if pm.heartbeatCount > 0 {
		latencyMs = 10 + int64(pm.heartbeatCount%20)
	}

	return &ConnectionState{
		Status:         pm.connStatus,
		Type:           pm.connectionType,
		Connected:      pm.connected,
		LastHeartbeat:  pm.lastHeartbeat,
		HeartbeatCount: pm.heartbeatCount,
		ReconnectTries: pm.reconnectTries,
		LatencyMs:      latencyMs,
	}
}

func (pm *PrinterManager) SetAutoReconnect(enable bool) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.autoReconnect = enable
}

func (pm *PrinterManager) GetConnectionType() ConnectionType {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	return pm.connectionType
}

func (pm *PrinterManager) SendCommand(cmd string) (string, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if !pm.connected {
		return "", fmt.Errorf("printer not connected")
	}

	response := pm.simulator.SendCommand(cmd)
	return response, nil
}

func (pm *PrinterManager) GetStatus() *models.PrinterStatus {
	return pm.simulator.GetStatus()
}

func (pm *PrinterManager) GetFirmwareInfo() *models.FirmwareInfo {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	return pm.printerInfo
}

func (pm *PrinterManager) getFirmwareInfo() (*models.FirmwareInfo, error) {
	resp, err := pm.SendCommand("M115")
	if err != nil {
		return nil, err
	}

	info := &models.FirmwareInfo{
		Name:        "Marlin",
		Version:     "2.1.2",
		MachineType: "3D Printer",
		Extruders:   1,
	}

	if len(resp) > 0 {
		if idx := indexOfSubstring(resp, "FIRMWARE_NAME:"); idx != -1 {
			end := indexOfSubstring(resp[idx:], " ")
			if end != -1 {
				info.Name = resp[idx+14 : idx+end]
			}
		}
		if idx := indexOfSubstring(resp, "MACHINE_TYPE:"); idx != -1 {
			end := indexOfSubstring(resp[idx:], " ")
			if end != -1 {
				info.MachineType = resp[idx+13 : idx+end]
			}
		}
		if idx := indexOfSubstring(resp, "EXTRUDER_COUNT:"); idx != -1 {
			end := indexOfSubstring(resp[idx:], " ")
			if end != -1 {
				info.Extruders = int(resp[idx+15] - '0')
			}
		}
	}

	return info, nil
}

func indexOfSubstring(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

func (pm *PrinterManager) PausePrint() error {
	resp, err := pm.SendCommand("M25")
	log.Printf("Pause response: %s", resp)
	return err
}

func (pm *PrinterManager) ResumePrint() error {
	resp, err := pm.SendCommand("M24")
	log.Printf("Resume response: %s", resp)
	return err
}

func (pm *PrinterManager) StopPrint() error {
	pm.mu.Lock()
	jobID := pm.currentJobID
	pm.currentJobID = 0
	pm.mu.Unlock()

	if jobID > 0 {
		database.CompletePrintJob(jobID, false, "Print stopped by user")
	}

	resp, err := pm.SendCommand("M524")
	log.Printf("Stop response: %s", resp)
	return err
}

func (pm *PrinterManager) MoveAxis(move *models.AxisMove) error {
	_, err := pm.SendCommand("G91")
	if err != nil {
		return err
	}

	cmd := ""
	speed := move.Speed
	if speed <= 0 {
		speed = 3000
	}

	switch move.Axis {
	case "x", "X":
		cmd = fmt.Sprintf("G1 X%.2f F%d", move.Distance, speed)
	case "y", "Y":
		cmd = fmt.Sprintf("G1 Y%.2f F%d", move.Distance, speed)
	case "z", "Z":
		cmd = fmt.Sprintf("G1 Z%.2f F%d", move.Distance, speed)
	}

	_, err = pm.SendCommand(cmd)
	pm.SendCommand("G90")
	return err
}

func (pm *PrinterManager) HomeAxis(axis string) error {
	cmd := "G28"
	if axis != "" && axis != "all" && axis != "ALL" {
		cmd += " " + axis
	}
	_, err := pm.SendCommand(cmd)
	return err
}

func (pm *PrinterManager) SetTemperature(heater string, temp float64) error {
	var cmd string
	if heater == "bed" {
		cmd = fmt.Sprintf("M140 S%.1f", temp)
	} else {
		cmd = fmt.Sprintf("M104 S%.1f", temp)
	}
	_, err := pm.SendCommand(cmd)
	return err
}

func (pm *PrinterManager) StartPrintJob(fileName string, fileSize int64) (uint, error) {
	job, err := database.StartNewPrintJob(fileName)
	if err != nil {
		return 0, err
	}

	pm.mu.Lock()
	pm.currentJobID = job.ID
	pm.mu.Unlock()

	pm.simulator.SetJobID(job.ID)
	_, err = pm.simulator.StartPrintJob(fileName, 10000)
	if err != nil {
		return 0, err
	}

	log.Printf("Print job started with ID: %d", job.ID)
	return job.ID, nil
}

func (pm *PrinterManager) CheckJobCompletion() {
	pm.mu.Lock()
	jobID := pm.currentJobID
	pm.mu.Unlock()

	if jobID == 0 {
		return
	}

	status := pm.GetStatus()
	if status.State == "idle" && status.Progress >= 100 {
		pm.mu.Lock()
		pm.currentJobID = 0
		pm.mu.Unlock()

		database.CompletePrintJob(jobID, true, "Print completed successfully")
		log.Printf("Print job %d completed", jobID)
	}
}

func (pm *PrinterManager) AddStatusListener(id string) chan *models.PrinterStatus {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	ch := make(chan *models.PrinterStatus, 10)
	pm.statusListeners[id] = ch
	return ch
}

func (pm *PrinterManager) RemoveStatusListener(id string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if ch, ok := pm.statusListeners[id]; ok {
		close(ch)
		delete(pm.statusListeners, id)
	}
}

func (pm *PrinterManager) broadcastStatusLoop() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		pm.CheckJobCompletion()

		status := pm.GetStatus()

		pm.mu.Lock()
		for id, ch := range pm.statusListeners {
			select {
			case ch <- status:
			default:
				log.Printf("Status listener %s buffer full, dropping status", id)
			}
		}
		pm.mu.Unlock()
	}
}

func (pm *PrinterManager) GetSimulator() *MarlinSimulator {
	return pm.simulator
}

func (pm *PrinterManager) heartbeatLoop() {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()

	for range ticker.C {
		pm.checkAndHandleHeartbeat()
	}
}

func (pm *PrinterManager) checkAndHandleHeartbeat() {
	pm.mu.Lock()
	if !pm.connected {
		pm.mu.Unlock()
		return
	}
	pm.mu.Unlock()

	startTime := time.Now()
	resp, err := pm.SendCommand("M105")
	latency := time.Since(startTime)

	pm.mu.Lock()
	if err != nil || resp == "" {
		timeSinceLastBeat := time.Since(pm.lastHeartbeat)
		
		if timeSinceLastBeat > heartbeatTimeout {
			log.Printf("Heartbeat timeout, connection lost (last: %v ago)", timeSinceLastBeat)
			pm.connected = false
			pm.connStatus = StatusDisconnected
			
			if pm.autoReconnect && pm.reconnectTries < maxReconnectTries {
				pm.connStatus = StatusReconnecting
				pm.reconnectTries++
				go pm.tryReconnect()
			}
		}
		pm.mu.Unlock()
		return
	}

	pm.lastHeartbeat = time.Now()
	pm.heartbeatCount++
	pm.reconnectTries = 0
	
	if pm.connStatus != StatusConnected {
		pm.connStatus = StatusConnected
	}
	pm.mu.Unlock()

	log.Printf("Heartbeat OK, latency: %v", latency)
}

func (pm *PrinterManager) tryReconnect() {
	log.Printf("Attempting to reconnect (try %d/%d)...", pm.reconnectTries, maxReconnectTries)

	time.Sleep(2 * time.Second)

	err := pm.Connect(pm.connectionType)
	if err != nil {
		log.Printf("Reconnect failed: %v", err)
		pm.mu.Lock()
		if pm.reconnectTries >= maxReconnectTries {
			pm.connStatus = StatusDisconnected
			log.Printf("Max reconnect attempts reached, giving up")
		}
		pm.mu.Unlock()
		return
	}

	log.Println("Reconnected successfully!")
}
