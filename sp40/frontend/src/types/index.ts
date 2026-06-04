export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Position {
  x: number
  y: number
}

export interface Orientation {
  roll: number
  pitch: number
  yaw: number
}

export interface IMUData {
  accel: Vector3
  gyro: Vector3
  orientation: Orientation
}

export interface Battery {
  voltage: number
  percentage: number
  current: number
}

export interface RobotInfo {
  id: string
  name: string
  position: Position
  status: 'idle' | 'moving' | 'recording' | 'error'
  heading?: number
}

export interface Obstacle {
  id: string
  x: number
  y: number
  radius: number
  type: 'static' | 'dynamic'
}

export interface PathPoint {
  x: number
  y: number
}

export interface RecordingInfo {
  id: string
  robotId: string
  startTime: number
  endTime: number
  frameCount: number
  name?: string
}

export interface ControlCommand {
  type: 'control'
  timestamp: number
  robotId?: string
  wheels: {
    leftSpeed: number
    rightSpeed: number
  }
  arm: {
    joints: number[]
  }
  force: {
    desiredTorques: number[]
  }
}

export interface SensorData {
  type: 'sensor'
  timestamp: number
  robotId: string
  position: Position
  imu: IMUData
  battery: Battery
  actualTorques: number[]
  jointAngles: number[]
}

export interface VideoFrame {
  type: 'video'
  timestamp: number
  sequence: number
  isKeyframe: boolean
  data: string
  robotId?: string
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ConnectionState {
  status: ConnectionStatus
  latency: number
  throughput: number
}

export interface RobotListMessage {
  type: 'robotList'
  robots: RobotInfo[]
}

export interface ObstacleListMessage {
  type: 'obstacleList'
  obstacles: Obstacle[]
}

export interface PathPlanningResponse {
  type: 'pathPlanResult'
  robotId: string
  waypoints: PathPoint[]
  success: boolean
}

export interface RecordingListMessage {
  type: 'recordingList'
  recordings: RecordingInfo[]
}

export type WebSocketMessage =
  | { type: 'ping'; id: number }
  | { type: 'pong'; id: number }
  | SensorData
  | VideoFrame
  | RobotListMessage
  | ObstacleListMessage
  | PathPlanningResponse
  | RecordingListMessage
