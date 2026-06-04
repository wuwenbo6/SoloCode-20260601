export interface SensorData {
  id: number
  ts: number
  temperature: number
  pressure: number
  vibration: number
}

export interface AlertPayload {
  sensorId: number
  metric: 'temperature' | 'pressure' | 'vibration'
  value: number
  threshold: number
  level: 'warning' | 'critical'
  timestamp: number
}

export interface ThresholdConfig {
  metric: 'temperature' | 'pressure' | 'vibration'
  minValue: number
  maxValue: number
  warningPercent: number
}

export interface ThresholdPayload {
  metric: 'temperature' | 'pressure' | 'vibration'
  min: number
  max: number
  warningPercent: number
}

export interface SubscribePayload {
  sensorIds: number[]
}

export interface HeartbeatPayload {
  ts: number
}

export interface HeartbeatAckPayload {
  ts: number
  rtt: number
}

export interface ViewState {
  selectedSensors: number[]
  viewMode: string
  showPrediction: boolean
  userId: string
  userName: string
}

export interface ViewStateSync {
  state: ViewState
  sessionId: string
  ts: number
}

export interface ReplayPayload {
  startTime: string
  endTime: string
  speed: 1 | 2 | 5 | 10
  sensorIds: number[]
}

export interface CongestionPayload {
  intervalMs: number
}

export interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'replay_start' | 'replay_stop' | 'set_threshold' | 'heartbeat_ack' | 'ack' | 'view_state_update'
  payload: SubscribePayload | ReplayPayload | ThresholdPayload | HeartbeatAckPayload | ViewState
}

export type ServerMessageType = 'sensor_data' | 'alert' | 'congestion' | 'replay_data' | 'replay_end' | 'heartbeat' | 'view_state_sync'

export interface ServerMessage {
  type: ServerMessageType
  payload: SensorData | AlertPayload | CongestionPayload | SensorData[] | HeartbeatPayload | ViewStateSync
}

export interface AlertRecord {
  id: number
  sensorId: number
  metric: 'temperature' | 'pressure' | 'vibration'
  value: number
  threshold: number
  level: 'warning' | 'critical'
  createdAt: string
  acknowledged: boolean
}

export interface SensorInfo {
  id: number
  name: string
  area: string
  status: 'normal' | 'warning' | 'critical' | 'offline'
}

export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected'

export interface TimeSeriesPoint {
  timestamp: number
  value: number
}
