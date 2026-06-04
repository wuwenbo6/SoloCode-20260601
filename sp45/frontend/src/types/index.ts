export interface PrinterStatus {
  timestamp: number;
  nozzle_temp: number;
  nozzle_target: number;
  bed_temp: number;
  bed_target: number;
  z_height: number;
  progress: number;
  state: string;
  file_name?: string;
  print_time?: number;
  time_left?: number;
}

export interface FirmwareInfo {
  name: string;
  version: string;
  machine_type: string;
  extruders: number;
}

export type ConnectionStatusType = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionStatus {
  status: ConnectionStatusType;
  type: string;
  connected: boolean;
  lastHeartbeat: string;
  heartbeatCount: number;
  reconnectTries: number;
  latencyMs: number;
}

export interface AxisMove {
  axis: string;
  distance: number;
  speed?: number;
}

export interface PrintJob {
  id: number;
  file_name: string;
  start_time: string;
  end_time?: string;
  status: string;
  duration?: number;
  success: boolean;
  notes?: string;
}

export interface PrintHistoryResponse {
  jobs: PrintJob[];
  total: number;
  limit: number;
  offset: number;
}

export interface VideoStreamInfo {
  active: boolean;
  fps: number;
  width: number;
  height: number;
  clients: number;
  transport: string;
  format: string;
}

export interface FirmwareProgress {
  progress: number;
  currentPage: number;
  totalPages: number;
  inProgress: boolean;
  paused: boolean;
  lastError: string;
  maxRetries: number;
  resumeState: {
    currentPage: number;
    totalPages: number;
    progress: number;
    completedPages: number;
    paused: boolean;
  };
}

export interface TemperaturePoint {
  timestamp: string;
  nozzle: number;
  bed: number;
}

export type PrinterState = 'idle' | 'printing' | 'paused' | 'homing' | 'heating' | 'busy';

export interface FailureAlert {
  type: 'warping' | 'clog' | 'spaghetti' | 'layer_shift' | 'stringing';
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  message: string;
  timestamp: number;
  frame_num: number;
  region: { x: number; y: number; width: number; height: number };
}

export interface DetectionConfig {
  enabled: boolean;
  sensitivity: number;
  warp_threshold: number;
  clog_threshold: number;
  alert_cooldown_ms: number;
  min_confidence: number;
}

export interface PrinterInfo {
  id: string;
  name: string;
  active: boolean;
  connected: boolean;
  status: string;
  state: string;
  progress: number;
  nozzle_temp: number;
  bed_temp: number;
}

export interface GCodePathSegment {
  type: string;
  from_x: number;
  from_y: number;
  from_z: number;
  to_x: number;
  to_y: number;
  to_z: number;
  extrude: boolean;
  speed: number;
  layer: number;
  line_num: number;
}

export interface GCodePreview {
  segments: GCodePathSegment[];
  bounds: {
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
    min_z: number;
    max_z: number;
  };
  layer_count: number;
  total_lines: number;
  filament_mm: number;
  est_time_min: number;
}
