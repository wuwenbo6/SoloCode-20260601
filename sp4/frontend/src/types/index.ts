export interface RMIDStats {
  rmid: number;
  llc_usage: number;
  mem_bw: number;
}

export interface CATAllocation {
  clos_id: number;
  clos_name: string;
  cbm: number;
  cache_ways: number;
  way_mask: string;
  llc_occupancy: number;
  llc_capacity: number;
  process_count: number;
}

export interface Process {
  pid: number;
  name: string;
  rmid: number;
  clos_id: number;
  llc_usage: number;
  llc_hit_rate: number;
  mem_bandwidth: number;
  read_bandwidth: number;
  write_bandwidth: number;
  llc_limit: number;
  bw_limit: number;
  start_time: string;
  status: string;
  priority: number;
  throttled: boolean;
}

export interface CLOSGroup {
  id: number;
  name: string;
  cbm: number;
  bw_mbps: number;
  color: string;
  cache_ways: number;
  llc_occupancy: number;
}

export interface SystemMetrics {
  timestamp: string;
  total_llc: number;
  used_llc: number;
  total_bw: number;
  used_bw: number;
  process_count: number;
  clos_count: number;
  throttled_count: number;
  rmid_stats: RMIDStats[];
  cat_allocations: CATAllocation[];
}

export interface MetricsHistory {
  timestamp: string;
  process_id: number;
  llc_hit_rate: number;
  mem_bw: number;
}

export interface SystemConfig {
  total_llc_capacity: number;
  total_bw_capacity: number;
  update_interval_ms: number;
  noise_coefficient: number;
  hit_rate_min: number;
  hit_rate_max: number;
}

export interface SimulatorStatus {
  running: boolean;
  start_time: string;
  uptime: string;
}

export interface CreateProcessRequest {
  name: string;
  rmid?: number;
  clos_id: number;
  llc_limit: number;
  bw_limit: number;
  priority: number;
}

export interface UpdateProcessRequest {
  name?: string;
  rmid?: number;
  clos_id?: number;
  llc_limit?: number;
  bw_limit?: number;
  priority?: number;
  status?: string;
}

export interface CreateCLOSRequest {
  name: string;
  cbm: number;
  bw_mbps: number;
  color: string;
}

export interface UpdateCLOSRequest {
  name?: string;
  cbm?: number;
  bw_mbps?: number;
  color?: string;
}

export interface WSMessage {
  type: string;
  data: WSMetricsData;
}

export interface WSMetricsData {
  system: SystemMetrics;
  processes: Process[];
  timestamp: string;
}
