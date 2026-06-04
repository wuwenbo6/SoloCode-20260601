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
