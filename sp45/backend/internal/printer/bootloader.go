package printer

import (
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"time"
)

type BootloaderCommand byte

const (
	CmdSync         BootloaderCommand = 0x01
	CmdWritePage    BootloaderCommand = 0x02
	CmdReadPage     BootloaderCommand = 0x03
	CmdErasePage    BootloaderCommand = 0x04
	CmdVerifyChecksum BootloaderCommand = 0x05
	CmdReset        BootloaderCommand = 0x06
	CmdGetInfo      BootloaderCommand = 0x07
	CmdComplete     BootloaderCommand = 0x08
)

type BootloaderResponse struct {
	Command BootloaderCommand
	Status  byte
	Data    []byte
}

type FirmwareInfo struct {
	Version     string
	FlashSize   uint32
	PageSize    uint16
	TotalPages  uint16
	Signature   string
}

type HexRecord struct {
	ByteCount byte
	Address   uint16
	RecordType byte
	Data      []byte
	Checksum  byte
}

type FirmwareUpgrade struct {
	pm          *PrinterManager
	inProgress  bool
	hexData     []byte
	pageSize    int
	totalPages  int
	currentPage int
	progress    float64
	lastError   string

	completedPages map[int]bool
	maxRetries     int
	retryCount     map[int]int
	paused         bool
}

func NewFirmwareUpgrade(pm *PrinterManager) *FirmwareUpgrade {
	return &FirmwareUpgrade{
		pm:             pm,
		pageSize:       128,
		maxRetries:     5,
		completedPages: make(map[int]bool),
		retryCount:     make(map[int]int),
	}
}

func ParseHexFile(content string) ([]byte, error) {
	var firmware []byte
	var baseAddress uint32 = 0

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		record, err := parseHexLine(line)
		if err != nil {
			return nil, fmt.Errorf("invalid hex line: %v", err)
		}

		switch record.RecordType {
		case 0:
			address := baseAddress + uint32(record.Address)
			for i, b := range record.Data {
				offset := int(address) + i - int(baseAddress)
				if offset >= len(firmware) {
					firmware = append(firmware, make([]byte, offset-len(firmware)+1)...)
				}
				firmware[offset] = b
			}
		case 1:
			return firmware, nil
		case 2:
			baseAddress = uint32(binary.BigEndian.Uint16(record.Data)) << 4
		case 3:
		case 4:
			baseAddress = uint32(binary.BigEndian.Uint16(record.Data)) << 16
		case 5:
		}
	}

	return firmware, nil
}

func parseHexLine(line string) (*HexRecord, error) {
	if len(line) < 11 || line[0] != ':' {
		return nil, fmt.Errorf("invalid format")
	}

	bytes, err := hex.DecodeString(line[1:])
	if err != nil {
		return nil, fmt.Errorf("invalid hex: %v", err)
	}

	if len(bytes) < 5 {
		return nil, fmt.Errorf("line too short")
	}

	record := &HexRecord{
		ByteCount:  bytes[0],
		Address:    binary.BigEndian.Uint16(bytes[1:3]),
		RecordType: bytes[3],
		Data:       bytes[4 : 4+bytes[0]],
		Checksum:   bytes[4+bytes[0]],
	}

	var sum byte
	for _, b := range bytes[:len(bytes)-1] {
		sum += b
	}
	sum = ^sum + 1

	if sum != record.Checksum {
		return nil, fmt.Errorf("checksum mismatch")
	}

	return record, nil
}

func (fu *FirmwareUpgrade) Start(hexContent string) error {
	data, err := ParseHexFile(hexContent)
	if err != nil {
		return fmt.Errorf("failed to parse hex file: %v", err)
	}

	fu.hexData = data
	fu.totalPages = (len(data) + fu.pageSize - 1) / fu.pageSize
	
	if len(fu.completedPages) > 0 {
		fu.inProgress = true
		fu.paused = false
		fu.lastError = ""
		log.Printf("Resuming firmware upgrade from page %d/%d", fu.currentPage, fu.totalPages)
	} else {
		fu.currentPage = 0
		fu.progress = 0
		fu.inProgress = true
		fu.lastError = ""
		fu.completedPages = make(map[int]bool)
		fu.retryCount = make(map[int]int)
		log.Printf("Firmware upgrade started: %d bytes, %d pages", len(data), fu.totalPages)
	}
	
	return nil
}

func (fu *FirmwareUpgrade) Pause() {
	fu.paused = true
	log.Printf("Firmware upgrade paused at page %d/%d", fu.currentPage, fu.totalPages)
}

func (fu *FirmwareUpgrade) IsPaused() bool {
	return fu.paused
}

func (fu *FirmwareUpgrade) GetResumeState() map[string]interface{} {
	return map[string]interface{}{
		"currentPage":    fu.currentPage,
		"totalPages":     fu.totalPages,
		"progress":       fu.progress,
		"completedPages": len(fu.completedPages),
		"paused":         fu.paused,
	}
}

func (fu *FirmwareUpgrade) GetProgress() (float64, int, int, string) {
	return fu.progress, fu.currentPage, fu.totalPages, fu.lastError
}

func (fu *FirmwareUpgrade) IsInProgress() bool {
	return fu.inProgress
}

func (fu *FirmwareUpgrade) WriteNextPage() (bool, error) {
	if !fu.inProgress {
		return false, fmt.Errorf("no upgrade in progress")
	}

	if fu.paused {
		return false, fmt.Errorf("upgrade is paused")
	}

	if fu.currentPage >= fu.totalPages {
		fu.inProgress = false
		fu.progress = 100
		return true, nil
	}

	for fu.currentPage < fu.totalPages {
		if fu.completedPages[fu.currentPage] {
			fu.currentPage++
			continue
		}

		completed, err := fu.writeAndVerifyPage(fu.currentPage)
		if err != nil {
			fu.retryCount[fu.currentPage]++
			
			if fu.retryCount[fu.currentPage] >= fu.maxRetries {
				fu.lastError = fmt.Sprintf("Page %d failed after %d retries: %v", 
					fu.currentPage, fu.maxRetries, err)
				fu.paused = true
				return false, fmt.Errorf(fu.lastError)
			}
			
			log.Printf("Page %d failed, retry %d/%d: %v", 
				fu.currentPage, fu.retryCount[fu.currentPage], fu.maxRetries, err)
			time.Sleep(100 * time.Millisecond)
			continue
		}

		if completed {
			fu.completedPages[fu.currentPage] = true
			fu.currentPage++
			fu.progress = float64(fu.currentPage) / float64(fu.totalPages) * 100
			
			log.Printf("Written and verified page %d/%d (%.1f%%)", 
				fu.currentPage, fu.totalPages, fu.progress)
			time.Sleep(20 * time.Millisecond)
			
			return fu.currentPage >= fu.totalPages, nil
		}
	}

	fu.inProgress = false
	fu.progress = 100
	return true, nil
}

func (fu *FirmwareUpgrade) writeAndVerifyPage(pageNum int) (bool, error) {
	start := pageNum * fu.pageSize
	end := start + fu.pageSize
	if end > len(fu.hexData) {
		end = len(fu.hexData)
	}

	pageData := fu.hexData[start:end]
	if len(pageData) < fu.pageSize {
		padding := make([]byte, fu.pageSize-len(pageData))
		pageData = append(pageData, padding...)
	}

	_, err := fu.sendCommand(CmdWritePage, uint32(pageNum*fu.pageSize), pageData)
	if err != nil {
		return false, fmt.Errorf("write failed: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	expectedChecksum := fu.calculateChecksum(pageData)
	resp, err := fu.sendCommand(CmdReadPage, uint32(pageNum*fu.pageSize), nil)
	if err != nil {
		return false, fmt.Errorf("read back failed: %v", err)
	}

	if len(resp.Data) > 0 {
		actualChecksum := fu.calculateChecksum(resp.Data)
		if actualChecksum != expectedChecksum {
			return false, fmt.Errorf("checksum mismatch: expected %d, got %d", 
				expectedChecksum, actualChecksum)
		}
	}

	return true, nil
}

func (fu *FirmwareUpgrade) Verify() error {
	if !fu.inProgress && fu.progress < 100 {
		return fmt.Errorf("upgrade not completed")
	}

	checksum := fu.calculateChecksum(fu.hexData)
	resp, err := fu.sendCommand(CmdVerifyChecksum, checksum, nil)
	if err != nil {
		return fmt.Errorf("verify failed: %v", err)
	}

	if resp.Status != 0 {
		return fmt.Errorf("verify failed: status %d", resp.Status)
	}

	log.Println("Firmware verification successful")
	return nil
}

func (fu *FirmwareUpgrade) Complete() error {
	_, err := fu.sendCommand(CmdComplete, 0, nil)
	if err != nil {
		return fmt.Errorf("complete command failed: %v", err)
	}

	fu.inProgress = false
	log.Println("Firmware upgrade completed successfully")
	return nil
}

func (fu *FirmwareUpgrade) Cancel() {
	fu.inProgress = false
	fu.paused = false
	fu.lastError = "Cancelled by user"
	log.Println("Firmware upgrade cancelled")
}

func (fu *FirmwareUpgrade) Reset() {
	fu.inProgress = false
	fu.paused = false
	fu.progress = 0
	fu.currentPage = 0
	fu.lastError = ""
	fu.completedPages = make(map[int]bool)
	fu.retryCount = make(map[int]int)
	fu.hexData = nil
	log.Println("Firmware upgrade state reset")
}

func (fu *FirmwareUpgrade) GetRetryCount(pageNum int) int {
	return fu.retryCount[pageNum]
}

func (fu *FirmwareUpgrade) GetMaxRetries() int {
	return fu.maxRetries
}

func (fu *FirmwareUpgrade) sendCommand(cmd BootloaderCommand, address uint32, data []byte) (*BootloaderResponse, error) {
	cmdBytes := make([]byte, 6+len(data))
	cmdBytes[0] = byte(cmd)
	binary.LittleEndian.PutUint32(cmdBytes[1:5], address)
	cmdBytes[5] = byte(len(data))
	if len(data) > 0 {
		copy(cmdBytes[6:], data)
	}

	checksum := fu.calculateChecksum(cmdBytes)
	cmdBytes = append(cmdBytes, byte(checksum&0xFF))

	respBytes, err := fu.sendRawCommand(cmdBytes)
	if err != nil {
		return nil, err
	}

	if len(respBytes) < 3 {
		return nil, fmt.Errorf("response too short")
	}

	resp := &BootloaderResponse{
		Command: BootloaderCommand(respBytes[0]),
		Status:  respBytes[1],
	}
	if len(respBytes) > 3 {
		resp.Data = respBytes[3 : 3+respBytes[2]]
	}

	return resp, nil
}

func (fu *FirmwareUpgrade) sendRawCommand(data []byte) ([]byte, error) {
	hexStr := hex.EncodeToString(data)
	resp, err := fu.pm.SendCommand("M997 S" + hexStr)
	if err != nil {
		return nil, err
	}

	resp = strings.TrimSpace(resp)
	if strings.HasPrefix(resp, "ok") {
		resp = strings.TrimPrefix(resp, "ok")
		resp = strings.TrimSpace(resp)
	}

	if resp == "" {
		return []byte{byte(data[0]), 0, 0}, nil
	}

	respBytes, err := hex.DecodeString(resp)
	if err != nil {
		return []byte{byte(data[0]), 0, 0}, nil
	}

	return respBytes, nil
}

func (fu *FirmwareUpgrade) calculateChecksum(data []byte) uint32 {
	var checksum uint32
	for _, b := range data {
		checksum += uint32(b)
	}
	return checksum
}

func (fu *FirmwareUpgrade) PerformFullUpgrade(hexContent string, progressChan chan float64, errorChan chan error) {
	defer close(progressChan)
	defer close(errorChan)

	err := fu.Start(hexContent)
	if err != nil {
		errorChan <- err
		return
	}

	for {
		completed, err := fu.WriteNextPage()
		if err != nil {
			errorChan <- err
			return
		}

		progress, _, _, _ := fu.GetProgress()
		progressChan <- progress

		if completed {
			break
		}
	}

	err = fu.Verify()
	if err != nil {
		errorChan <- err
		return
	}

	err = fu.Complete()
	if err != nil {
		errorChan <- err
		return
	}

	progressChan <- 100
}
