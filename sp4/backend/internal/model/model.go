package model

import "time"

type Process struct {
	PID            int       `json:"pid"`
	Name           string    `json:"name"`
	RMID           int       `json:"rmid"`
	CLOSID         int       `json:"clos_id"`
	LLCUsage       float64   `json:"llc_usage"`
	LLCHitRate     float64   `json:"llc_hit_rate"`
	MemBandwidth   float64   `json:"mem_bandwidth"`
	ReadBandwidth  float64   `json:"read_bandwidth"`
	WriteBandwidth float64   `json:"write_bandwidth"`
	LLCLimit       float64   `json:"llc_limit"`
	BWLimit        float64   `json:"bw_limit"`
	StartTime      time.Time `json:"start_time"`
	Status         string    `json:"status"`
	Priority       int       `json:"priority"`
	Throttled      bool      `json:"throttled"`
}

type CLOSGroup struct {
	ID            int    `json:"id"`
	Name          string `json:"name"`
	CBM           uint64 `json:"cbm"`
	BWMbps        int    `json:"bw_mbps"`
	Color         string `json:"color"`
	CacheWays     int    `json:"cache_ways"`
	LLCOccupancy  float64 `json:"llc_occupancy"`
}

type CATAllocation struct {
	CLOSID       int     `json:"clos_id"`
	CLOSName     string  `json:"clos_name"`
	CBM          uint64  `json:"cbm"`
	CacheWays    int     `json:"cache_ways"`
	WayMask      string  `json:"way_mask"`
	LLCOccupancy float64 `json:"llc_occupancy"`
	LLCCapacity  float64 `json:"llc_capacity"`
	ProcessCount int     `json:"process_count"`
}

type RMIDStats struct {
	RMID     int     `json:"rmid"`
	LLCUsage float64 `json:"llc_usage"`
	MemBW    float64 `json:"mem_bw"`
}

type SystemMetrics struct {
	Timestamp       time.Time       `json:"timestamp"`
	TotalLLC        float64         `json:"total_llc"`
	UsedLLC         float64         `json:"used_llc"`
	TotalBW         float64         `json:"total_bw"`
	UsedBW          float64         `json:"used_bw"`
	ProcessCount    int             `json:"process_count"`
	CLOSCount       int             `json:"clos_count"`
	ThrottledCount  int             `json:"throttled_count"`
	RMIDStats       []RMIDStats     `json:"rmid_stats"`
	CATAllocations  []CATAllocation `json:"cat_allocations"`
}

type MetricsHistory struct {
	Timestamp  time.Time `json:"timestamp"`
	ProcessID  int       `json:"process_id"`
	LLCHitRate float64   `json:"llc_hit_rate"`
	MemBW      float64   `json:"mem_bw"`
}

type SystemConfig struct {
	TotalLLCCapacity float64 `json:"total_llc_capacity"`
	TotalBWCapacity  float64 `json:"total_bw_capacity"`
	UpdateIntervalMs int     `json:"update_interval_ms"`
	NoiseCoefficient float64 `json:"noise_coefficient"`
	HitRateMin       float64 `json:"hit_rate_min"`
	HitRateMax       float64 `json:"hit_rate_max"`
}

type SimulatorStatus struct {
	Running   bool      `json:"running"`
	StartTime time.Time `json:"start_time"`
	Uptime    string    `json:"uptime"`
}

type CreateProcessRequest struct {
	Name     string `json:"name" binding:"required"`
	RMID     int    `json:"rmid"`
	CLOSID   int    `json:"clos_id"`
	LLCLimit float64 `json:"llc_limit"`
	BWLimit  float64 `json:"bw_limit"`
	Priority int    `json:"priority"`
}

type UpdateProcessRequest struct {
	Name     string `json:"name"`
	RMID     *int   `json:"rmid"`
	CLOSID   int    `json:"clos_id"`
	LLCLimit float64 `json:"llc_limit"`
	BWLimit  float64 `json:"bw_limit"`
	Priority int    `json:"priority"`
	Status   string `json:"status"`
}

type CreateCLOSRequest struct {
	Name   string `json:"name" binding:"required"`
	CBM    uint64 `json:"cbm"`
	BWMbps int    `json:"bw_mbps"`
	Color  string `json:"color"`
}

type UpdateCLOSRequest struct {
	Name   string `json:"name"`
	CBM    uint64 `json:"cbm"`
	BWMbps int    `json:"bw_mbps"`
	Color  string `json:"color"`
}

type WSMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type WSMetricsData struct {
	System    SystemMetrics `json:"system"`
	Processes []Process     `json:"processes"`
	Timestamp time.Time     `json:"timestamp"`
}
