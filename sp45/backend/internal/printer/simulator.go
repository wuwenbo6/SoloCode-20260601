package printer

import (
	"3d-printer-controller/internal/models"
	"3d-printer-controller/pkg/gcode"
	"fmt"
	"log"
	"math"
	"math/rand"
	"strings"
	"sync"
	"time"
)

type PrinterState string

const (
	StateIdle       PrinterState = "idle"
	StatePrinting   PrinterState = "printing"
	StatePaused     PrinterState = "paused"
	StateHoming     PrinterState = "homing"
	StateHeating    PrinterState = "heating"
	StateBusy       PrinterState = "busy"
)

type MarlinSimulator struct {
	mu sync.Mutex

	state PrinterState

	nozzleTemp   float64
	nozzleTarget float64
	bedTemp      float64
	bedTarget    float64

	xPos float64
	yPos float64
	zPos float64
	ePos float64

	feedRate     float64
	maxFeedRate  map[string]float64
	acceleration map[string]float64

	absoluteMode bool
	absoluteE    bool

	printProgress float64
	printFileName string
	printStartTime time.Time
	totalPrintTime int64
	currentLine    int
	totalLines     int

	jobID    uint
	jobActive bool

	stepSize float64

	tempHistory []models.TemperaturePoint
	maxHistory  int

	responseChannel chan string
}

func NewMarlinSimulator() *MarlinSimulator {
	sim := &MarlinSimulator{
		state:          StateIdle,
		nozzleTemp:     25.0,
		bedTemp:        25.0,
		absoluteMode:   true,
		absoluteE:      false,
		feedRate:       3000,
		stepSize:       0.1,
		maxHistory:     100,
		responseChannel: make(chan string, 100),
		maxFeedRate: map[string]float64{
			"X": 500, "Y": 500, "Z": 10, "E": 50,
		},
		acceleration: map[string]float64{
			"X": 1000, "Y": 1000, "Z": 200, "E": 10000,
		},
	}

	go sim.temperatureControlLoop()
	go sim.simulatePrintProgress()

	return sim
}

func (m *MarlinSimulator) SendCommand(cmdLine string) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmdLine = strings.TrimSpace(cmdLine)
	if cmdLine == "" {
		return "ok"
	}

	cmd, err := gcode.Parse(cmdLine)
	if err != nil {
		return fmt.Sprintf("echo:Unknown command: \"%s\"\nok", cmdLine)
	}

	response := m.executeCommand(cmd)
	return response
}

func (m *MarlinSimulator) executeCommand(cmd *gcode.Command) string {
	switch cmd.Letter {
	case "G":
		return m.handleGCommand(cmd)
	case "M":
		return m.handleMCommand(cmd)
	default:
		return fmt.Sprintf("echo:Unknown command: \"%s\"\nok", cmd.Raw)
	}
}

func (m *MarlinSimulator) handleGCommand(cmd *gcode.Command) string {
	switch cmd.Number {
	case 0, 1:
		return m.handleG0G1(cmd)
	case 28:
		return m.handleG28(cmd)
	case 90:
		m.absoluteMode = true
		m.absoluteE = true
		return "echo:Absolute positioning\nok"
	case 91:
		m.absoluteMode = false
		m.absoluteE = false
		return "echo:Relative positioning\nok"
	case 92:
		return m.handleG92(cmd)
	default:
		return fmt.Sprintf("echo:G%d not implemented\nok", cmd.Number)
	}
}

func (m *MarlinSimulator) handleG0G1(cmd *gcode.Command) string {
	if cmd.HasParam("F") {
		m.feedRate = cmd.GetParamDefault("F", m.feedRate)
	}

	targetX, hasX := cmd.GetParam("X")
	targetY, hasY := cmd.GetParam("Y")
	targetZ, hasZ := cmd.GetParam("Z")
	targetE, hasE := cmd.GetParam("E")

	if !hasX && !hasY && !hasZ && !hasE {
		return "ok"
	}

	m.state = StateBusy

	if m.absoluteMode {
		if hasX {
			m.xPos = math.Max(0, math.Min(200, targetX))
		}
		if hasY {
			m.yPos = math.Max(0, math.Min(200, targetY))
		}
		if hasZ {
			m.zPos = math.Max(0, math.Min(200, targetZ))
		}
	} else {
		if hasX {
			m.xPos = math.Max(0, math.Min(200, m.xPos+targetX))
		}
		if hasY {
			m.yPos = math.Max(0, math.Min(200, m.yPos+targetY))
		}
		if hasZ {
			m.zPos = math.Max(0, math.Min(200, m.zPos+targetZ))
		}
	}

	if m.absoluteE {
		if hasE {
			m.ePos = math.Max(0, targetE)
		}
	} else {
		if hasE {
			m.ePos = math.Max(0, m.ePos+targetE)
		}
	}

	time.Sleep(50 * time.Millisecond)

	if m.state == StateBusy {
		m.state = StateIdle
		if m.jobActive {
			m.state = StatePrinting
		}
	}

	return "ok"
}

func (m *MarlinSimulator) handleG28(cmd *gcode.Command) string {
	m.state = StateHoming

	homeX := !cmd.HasParam("X") || cmd.GetParamDefault("X", 0) != 0
	homeY := !cmd.HasParam("Y") || cmd.GetParamDefault("Y", 0) != 0
	homeZ := !cmd.HasParam("Z") || cmd.GetParamDefault("Z", 0) != 0

	if homeX {
		m.xPos = 0
		time.Sleep(200 * time.Millisecond)
	}
	if homeY {
		m.yPos = 0
		time.Sleep(200 * time.Millisecond)
	}
	if homeZ {
		m.zPos = 0
		time.Sleep(300 * time.Millisecond)
	}

	m.state = StateIdle
	if m.jobActive {
		m.state = StatePrinting
	}

	return "X:0.00 Y:0.00 Z:0.00 E:0.00\nok"
}

func (m *MarlinSimulator) handleG92(cmd *gcode.Command) string {
	if cmd.HasParam("X") {
		m.xPos = cmd.GetParamDefault("X", m.xPos)
	}
	if cmd.HasParam("Y") {
		m.yPos = cmd.GetParamDefault("Y", m.yPos)
	}
	if cmd.HasParam("Z") {
		m.zPos = cmd.GetParamDefault("Z", m.zPos)
	}
	if cmd.HasParam("E") {
		m.ePos = cmd.GetParamDefault("E", m.ePos)
	}

	return fmt.Sprintf("X:%.2f Y:%.2f Z:%.2f E:%.2f\nok", m.xPos, m.yPos, m.zPos, m.ePos)
}

func (m *MarlinSimulator) handleMCommand(cmd *gcode.Command) string {
	switch cmd.Number {
	case 104:
		return m.handleM104(cmd)
	case 105:
		return m.handleM105()
	case 140:
		return m.handleM140(cmd)
	case 106:
		return "echo:Fan on\nok"
	case 107:
		return "echo:Fan off\nok"
	case 109:
		return m.handleM109(cmd)
	case 190:
		return m.handleM190(cmd)
	case 24:
		return m.handleM24()
	case 25:
		return m.handleM25()
	case 524:
		return m.handleM524()
	case 115:
		return m.handleM115()
	case 114:
		return m.handleM114()
	case 20:
		return "echo:SD card ok\nok"
	case 21:
		return "echo:SD init fail\nok"
	case 23:
		m.printFileName = "file.gcode"
		return "ok"
	case 27:
		return fmt.Sprintf("SD printing byte %d/%d\nok", int(m.printProgress*float64(m.totalLines)), m.totalLines)
	case 30:
		return "ok"
	case 31:
		return "ok"
	case 32:
		return m.handleM32(cmd)
	case 111:
		return "ok"
	case 220:
		return "ok"
	case 221:
		return "ok"
	case 400:
		return "ok"
	case 410:
		return "ok"
	case 500:
		return m.handleM500()
	case 501:
		return "ok"
	case 502:
		return "ok"
	case 503:
		return m.handleM503()
	default:
		return fmt.Sprintf("echo:M%d not implemented\nok", cmd.Number)
	}
}

func (m *MarlinSimulator) handleM104(cmd *gcode.Command) string {
	if temp, ok := cmd.GetParam("S"); ok {
		m.nozzleTarget = temp
		if temp > 0 {
			m.state = StateHeating
		}
	}
	return fmt.Sprintf("echo:Hotend set to %.1f\nok", m.nozzleTarget)
}

func (m *MarlinSimulator) handleM105() string {
	return fmt.Sprintf("ok T:%.2f /%.2f B:%.2f /%.2f @:0 B@:0",
		m.nozzleTemp, m.nozzleTarget, m.bedTemp, m.bedTarget)
}

func (m *MarlinSimulator) handleM140(cmd *gcode.Command) string {
	if temp, ok := cmd.GetParam("S"); ok {
		m.bedTarget = temp
		if temp > 0 {
			m.state = StateHeating
		}
	}
	return fmt.Sprintf("echo:Bed set to %.1f\nok", m.bedTarget)
}

func (m *MarlinSimulator) handleM109(cmd *gcode.Command) string {
	if temp, ok := cmd.GetParam("S"); ok {
		m.nozzleTarget = temp
	}
	if temp, ok := cmd.GetParam("R"); ok {
		m.nozzleTarget = temp
	}

	m.state = StateHeating
	for math.Abs(m.nozzleTemp-m.nozzleTarget) > 1.0 {
		time.Sleep(100 * time.Millisecond)
	}

	if m.state == StateHeating {
		m.state = StateIdle
		if m.jobActive {
			m.state = StatePrinting
		}
	}

	return fmt.Sprintf("ok T:%.2f /%.2f", m.nozzleTemp, m.nozzleTarget)
}

func (m *MarlinSimulator) handleM190(cmd *gcode.Command) string {
	if temp, ok := cmd.GetParam("S"); ok {
		m.bedTarget = temp
	}
	if temp, ok := cmd.GetParam("R"); ok {
		m.bedTarget = temp
	}

	m.state = StateHeating
	for math.Abs(m.bedTemp-m.bedTarget) > 1.0 {
		time.Sleep(100 * time.Millisecond)
	}

	if m.state == StateHeating {
		m.state = StateIdle
		if m.jobActive {
			m.state = StatePrinting
		}
	}

	return fmt.Sprintf("ok B:%.2f /%.2f", m.bedTemp, m.bedTarget)
}

func (m *MarlinSimulator) handleM24() string {
	if m.state == StatePaused {
		m.state = StatePrinting
		return "echo:Print resumed\nok"
	}
	return "ok"
}

func (m *MarlinSimulator) handleM25() string {
	if m.state == StatePrinting {
		m.state = StatePaused
		return "echo:Print paused\nok"
	}
	return "ok"
}

func (m *MarlinSimulator) handleM524() string {
	m.jobActive = false
	m.state = StateIdle
	m.printProgress = 0
	m.currentLine = 0
	return "echo:Print aborted\nok"
}

func (m *MarlinSimulator) handleM115() string {
	return "FIRMWARE_NAME:Marlin 2.1.2 (Simulator) SOURCE_CODE_URL:https://marlinfw.org " +
		"PROTOCOL_VERSION:1.0 MACHINE_TYPE:Simulated 3D Printer EXTRUDER_COUNT:1 UUID:00000000-0000-0000-0000-000000000000\nok"
}

func (m *MarlinSimulator) handleM114() string {
	return fmt.Sprintf("X:%.2f Y:%.2f Z:%.2f E:%.2f Count X:0 Y:0 Z:0\nok",
		m.xPos, m.yPos, m.zPos, m.ePos)
}

func (m *MarlinSimulator) handleM32(cmd *gcode.Command) string {
	fileName, _ := cmd.GetParam("S")
	m.printFileName = fmt.Sprintf("%.0f.gcode", fileName)
	m.StartPrintJob(m.printFileName, 10000)
	return "ok"
}

func (m *MarlinSimulator) handleM500() string {
	return "echo:Settings Stored\nok"
}

func (m *MarlinSimulator) handleM503() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("echo:  M203 X%.2f Y%.2f Z%.2f E%.2f\n",
		m.maxFeedRate["X"], m.maxFeedRate["Y"], m.maxFeedRate["Z"], m.maxFeedRate["E"]))
	sb.WriteString(fmt.Sprintf("echo:  M201 X%.0f Y%.0f Z%.0f E%.0f\n",
		m.acceleration["X"], m.acceleration["Y"], m.acceleration["Z"], m.acceleration["E"]))
	sb.WriteString("echo:  M92 X80.00 Y80.00 Z400.00 E93.00\n")
	sb.WriteString("ok")
	return sb.String()
}

func (m *MarlinSimulator) StartPrintJob(fileName string, totalLines int) (uint, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.jobActive = true
	m.state = StatePrinting
	m.printFileName = fileName
	m.printStartTime = time.Now()
	m.totalLines = totalLines
	m.currentLine = 0
	m.printProgress = 0

	log.Printf("Print job started: %s", fileName)
	return 0, nil
}

func (m *MarlinSimulator) SetJobID(id uint) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.jobID = id
}

func (m *MarlinSimulator) PausePrint() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.state == StatePrinting {
		m.state = StatePaused
		return "echo:Print paused\nok"
	}
	return "ok"
}

func (m *MarlinSimulator) ResumePrint() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.state == StatePaused {
		m.state = StatePrinting
		return "echo:Print resumed\nok"
	}
	return "ok"
}

func (m *MarlinSimulator) StopPrint() string {
	m.mu.Lock()
	defer m.mu.Unlock()

	wasPrinting := m.jobActive
	m.jobActive = false
	m.state = StateIdle
	m.printProgress = 0
	m.currentLine = 0

	if wasPrinting {
		return "echo:Print stopped\nok"
	}
	return "ok"
}

func (m *MarlinSimulator) GetStatus() *models.PrinterStatus {
	m.mu.Lock()
	defer m.mu.Unlock()

	printTime := int64(0)
	timeLeft := int64(0)
	if !m.printStartTime.IsZero() {
		printTime = int64(time.Since(m.printStartTime).Seconds())
		if m.printProgress > 0 && m.printProgress < 100 {
			totalEstimate := float64(printTime) / (m.printProgress / 100.0)
			timeLeft = int64(totalEstimate - float64(printTime))
		}
	}

	return &models.PrinterStatus{
		Timestamp:    time.Now().UnixMilli(),
		NozzleTemp:   math.Round(m.nozzleTemp*100) / 100,
		NozzleTarget: m.nozzleTarget,
		BedTemp:      math.Round(m.bedTemp*100) / 100,
		BedTarget:    m.bedTarget,
		ZHeight:      math.Round(m.zPos*100) / 100,
		Progress:     math.Round(m.printProgress*100) / 100,
		State:        string(m.state),
		FileName:     m.printFileName,
		PrintTime:    printTime,
		TimeLeft:     timeLeft,
	}
}

func (m *MarlinSimulator) GetJobID() uint {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.jobID
}

func (m *MarlinSimulator) IsJobActive() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.jobActive
}

func (m *MarlinSimulator) GetState() PrinterState {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.state
}

func (m *MarlinSimulator) MoveAxis(axis string, distance float64, speed int) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	if speed <= 0 {
		speed = 3000
	}

	cmd := fmt.Sprintf("G1 %s%.2f F%d", strings.ToUpper(axis), distance, speed)
	return m.executeCommandDirect(cmd)
}

func (m *MarlinSimulator) HomeAxis(axis string) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	axis = strings.ToUpper(axis)
	cmd := "G28"
	if axis != "ALL" {
		cmd += fmt.Sprintf(" %s", axis)
	}
	return m.executeCommandDirect(cmd)
}

func (m *MarlinSimulator) SetTemperature(heater string, temp float64) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	var cmd string
	if strings.ToLower(heater) == "bed" {
		cmd = fmt.Sprintf("M140 S%.1f", temp)
	} else {
		cmd = fmt.Sprintf("M104 S%.1f", temp)
	}
	return m.executeCommandDirect(cmd)
}

func (m *MarlinSimulator) executeCommandDirect(cmdLine string) string {
	cmd, err := gcode.Parse(cmdLine)
	if err != nil {
		return fmt.Sprintf("echo:Unknown command: \"%s\"\nok", cmdLine)
	}
	return m.executeCommand(cmd)
}

func (m *MarlinSimulator) temperatureControlLoop() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.Lock()

		if m.nozzleTemp < m.nozzleTarget {
			m.nozzleTemp += 0.5 + rand.Float64()*0.3
			if m.nozzleTemp > m.nozzleTarget {
				m.nozzleTemp = m.nozzleTarget
			}
		} else if m.nozzleTemp > m.nozzleTarget {
			m.nozzleTemp -= 0.3 + rand.Float64()*0.2
			if m.nozzleTemp < m.nozzleTarget {
				m.nozzleTemp = m.nozzleTarget
			}
		}
		m.nozzleTemp += (rand.Float64() - 0.5) * 0.3

		if m.bedTemp < m.bedTarget {
			m.bedTemp += 0.3 + rand.Float64()*0.2
			if m.bedTemp > m.bedTarget {
				m.bedTemp = m.bedTarget
			}
		} else if m.bedTemp > m.bedTarget {
			m.bedTemp -= 0.2 + rand.Float64()*0.1
			if m.bedTemp < m.bedTarget {
				m.bedTemp = m.bedTarget
			}
		}
		m.bedTemp += (rand.Float64() - 0.5) * 0.2

		if m.nozzleTarget == 0 && m.nozzleTemp > 25 {
			m.nozzleTemp -= 0.2
		}
		if m.bedTarget == 0 && m.bedTemp > 25 {
			m.bedTemp -= 0.1
		}

		m.tempHistory = append(m.tempHistory, models.TemperaturePoint{
			Timestamp: time.Now(),
			Nozzle:    m.nozzleTemp,
			Bed:       m.bedTemp,
		})
		if len(m.tempHistory) > m.maxHistory {
			m.tempHistory = m.tempHistory[1:]
		}

		if m.state == StateHeating {
			if math.Abs(m.nozzleTemp-m.nozzleTarget) < 2.0 &&
				math.Abs(m.bedTemp-m.bedTarget) < 2.0 {
				if m.jobActive {
					m.state = StatePrinting
				} else {
					m.state = StateIdle
				}
			}
		}

		m.mu.Unlock()
	}
}

func (m *MarlinSimulator) simulatePrintProgress() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.Lock()

		if m.state == StatePrinting && m.jobActive {
			m.currentLine++
			if m.totalLines > 0 {
				m.printProgress = float64(m.currentLine) / float64(m.totalLines) * 100
			}

			if m.currentLine%10 == 0 {
				m.zPos += 0.2
				if m.zPos > 100 {
					m.zPos = 0.2
				}
			}

			if m.printProgress >= 100 {
				m.jobActive = false
				m.state = StateIdle
				log.Printf("Print job completed: %s", m.printFileName)
			}
		}

		m.mu.Unlock()
	}
}
