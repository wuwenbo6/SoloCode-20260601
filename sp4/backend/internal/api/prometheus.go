package api

import (
	"fmt"
	"net/http"

	"github.com/wuwenbo/rdt-simulator/backend/internal/storage"
)

type PrometheusHandler struct {
	store *storage.Storage
}

func NewPrometheusHandler(store *storage.Storage) *PrometheusHandler {
	return &PrometheusHandler{store: store}
}

func (p *PrometheusHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	metrics := p.store.GetSystemMetrics()
	processes := p.store.GetAllProcesses()
	closGroups := p.store.GetAllCLOSGroups()
	config := p.store.GetConfig()

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

	var output string

	output += p.gauge("rdt_system_llc_total", "Total LLC capacity", metrics.TotalLLC)
	output += p.gauge("rdt_system_llc_used", "Used LLC", metrics.UsedLLC)
	output += p.gauge("rdt_system_bw_total_mbps", "Total memory bandwidth capacity", metrics.TotalBW)
	output += p.gauge("rdt_system_bw_used_mbps", "Used memory bandwidth", metrics.UsedBW)
	output += p.gauge("rdt_system_process_count", "Number of processes", float64(metrics.ProcessCount))
	output += p.gauge("rdt_system_clos_count", "Number of CLOS groups", float64(metrics.CLOSCount))
	output += p.gauge("rdt_system_throttled_count", "Number of throttled processes", float64(metrics.ThrottledCount))

	output += p.gauge("rdt_config_llc_capacity", "Configured LLC capacity", config.TotalLLCCapacity)
	output += p.gauge("rdt_config_bw_capacity_mbps", "Configured BW capacity", config.TotalBWCapacity)
	output += p.gauge("rdt_config_update_interval_ms", "Update interval in ms", float64(config.UpdateIntervalMs))
	output += p.gauge("rdt_config_noise_coefficient", "Noise coefficient", config.NoiseCoefficient)

	for _, proc := range processes {
		labels := fmt.Sprintf(`pid="%d",name="%s",rmid="%d",clos_id="%d"`,
			proc.PID, proc.Name, proc.RMID, proc.CLOSID)

		output += p.gaugeL("rdt_process_llc_usage", "Process LLC usage", labels, proc.LLCUsage)
		output += p.gaugeL("rdt_process_llc_hit_rate", "Process LLC hit rate", labels, proc.LLCHitRate)
		output += p.gaugeL("rdt_process_mem_bandwidth_mbps", "Process memory bandwidth MB/s", labels, proc.MemBandwidth)
		output += p.gaugeL("rdt_process_read_bandwidth_mbps", "Process read bandwidth MB/s", labels, proc.ReadBandwidth)
		output += p.gaugeL("rdt_process_write_bandwidth_mbps", "Process write bandwidth MB/s", labels, proc.WriteBandwidth)
		output += p.gaugeL("rdt_process_llc_limit", "Process LLC limit", labels, proc.LLCLimit)
		output += p.gaugeL("rdt_process_bw_limit_mbps", "Process BW limit MB/s", labels, proc.BWLimit)

		throttled := 0.0
		if proc.Throttled {
			throttled = 1.0
		}
		output += p.gaugeL("rdt_process_throttled", "Process throttled status (1=throttled)", labels, throttled)

		running := 0.0
		if proc.Status == "running" {
			running = 1.0
		}
		output += p.gaugeL("rdt_process_running", "Process running status (1=running)", labels, running)
	}

	for _, clos := range closGroups {
		labels := fmt.Sprintf(`clos_id="%d",name="%s"`, clos.ID, clos.Name)

		output += p.gaugeL("rdt_clos_cbm", "CLOS Capacity Bitmask", labels, float64(clos.CBM))
		output += p.gaugeL("rdt_clos_cache_ways", "CLOS allocated cache ways", labels, float64(clos.CacheWays))
		output += p.gaugeL("rdt_clos_bw_limit_mbps", "CLOS bandwidth limit MB/s", labels, float64(clos.BWMbps))
		output += p.gaugeL("rdt_clos_llc_occupancy", "CLOS LLC occupancy", labels, clos.LLCOccupancy)
	}

	for _, cat := range metrics.CATAllocations {
		labels := fmt.Sprintf(`clos_id="%d",clos_name="%s",way_mask="%s"`,
			cat.CLOSID, cat.CLOSName, cat.WayMask)

		output += p.gaugeL("rdt_cat_cache_ways", "CAT allocated cache ways per CLOS", labels, float64(cat.CacheWays))
		output += p.gaugeL("rdt_cat_llc_capacity", "CAT LLC capacity per CLOS", labels, cat.LLCCapacity)
		output += p.gaugeL("rdt_cat_llc_occupancy", "CAT LLC occupancy per CLOS", labels, cat.LLCOccupancy)
		output += p.gaugeL("rdt_cat_process_count", "CAT process count per CLOS", labels, float64(cat.ProcessCount))
	}

	for _, rs := range metrics.RMIDStats {
		labels := fmt.Sprintf(`rmid="%d"`, rs.RMID)
		output += p.gaugeL("rdt_rmid_llc_usage", "RMID LLC usage", labels, rs.LLCUsage)
		output += p.gaugeL("rdt_rmid_mem_bw_mbps", "RMID memory bandwidth MB/s", labels, rs.MemBW)
	}

	fmt.Fprint(w, output)
}

func (p *PrometheusHandler) gauge(name, help string, value float64) string {
	return fmt.Sprintf("# HELP %s %s\n# TYPE %s gauge\n%s %v\n", name, help, name, name, value)
}

func (p *PrometheusHandler) gaugeL(name, help, labels string, value float64) string {
	return fmt.Sprintf("# HELP %s %s\n# TYPE %s gauge\n%s{%s} %v\n", name, help, name, name, labels, value)
}
