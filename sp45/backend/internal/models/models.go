package models

import (
	"time"
)

type PrinterStatus struct {
	Timestamp    int64   `json:"timestamp"`
	NozzleTemp   float64 `json:"nozzle_temp"`
	NozzleTarget float64 `json:"nozzle_target"`
	BedTemp      float64 `json:"bed_temp"`
	BedTarget    float64 `json:"bed_target"`
	ZHeight      float64 `json:"z_height"`
	Progress     float64 `json:"progress"`
	State        string  `json:"state"`
	FileName     string  `json:"file_name,omitempty"`
	PrintTime    int64   `json:"print_time,omitempty"`
	TimeLeft     int64   `json:"time_left,omitempty"`
}

type PrintJob struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	FileName  string    `json:"file_name"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time,omitempty"`
	Status    string    `json:"status"`
	Duration  int64     `json:"duration,omitempty"`
	Success   bool      `json:"success"`
	Notes     string    `json:"notes,omitempty"`
}

type AxisMove struct {
	Axis     string  `json:"axis"`
	Distance float64 `json:"distance"`
	Speed    int     `json:"speed,omitempty"`
}

type FirmwareInfo struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	MachineType string `json:"machine_type"`
	Extruders   int    `json:"extruders"`
}

type TemperaturePoint struct {
	Timestamp time.Time `json:"timestamp"`
	Nozzle    float64   `json:"nozzle"`
	Bed       float64   `json:"bed"`
}
