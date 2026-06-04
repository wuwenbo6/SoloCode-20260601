export interface InputEventMessage {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'keydown' | 'keyup' | 'touchstart' | 'touchmove' | 'touchend'
  timestamp: number
  sequence: number
  predicted?: boolean
  data: {
    x?: number
    y?: number
    button?: number
    key?: string
    touches?: Array<{ id: number; x: number; y: number }>
  }
}

export interface BitrateFeedback {
  type: 'bitrate-feedback'
  timestamp: number
  data: {
    targetBitrate: number
    packetLoss: number
    rtt: number
  }
}

export interface KeyframeRequest {
  type: 'keyframe-request'
  timestamp: number
  data: {
    lastReceivedFrameId: number
  }
}

export interface NackRequest {
  type: 'nack-request'
  timestamp: number
  data: {
    missingFrameIds: number[]
  }
}

export interface JoystickMessage {
  type: 'joystick'
  timestamp: number
  sequence: number
  predicted?: boolean
  data: {
    dx?: number
    dy?: number
  }
}

export interface ButtonMessage {
  type: 'button'
  timestamp: number
  sequence: number
  predicted?: boolean
  data: {
    buttonId: string
    pressed: boolean
  }
}

export interface InputStateSync {
  type: 'input-state-sync'
  timestamp: number
  sequence: number
  data: {
    left: boolean
    right: boolean
    shoot: boolean
    mouseX: number | null
    useMouseControl: boolean
  }
}

export interface QualityChangeRequest {
  type: 'quality-change'
  timestamp: number
  data: {
    quality: '1080p' | '720p' | '480p'
    width: number
    height: number
  }
}

export type ClientMessage = InputEventMessage | BitrateFeedback | KeyframeRequest | NackRequest | JoystickMessage | ButtonMessage | InputStateSync | QualityChangeRequest

export interface GameObject {
  type: 'star' | 'player' | 'enemy' | 'bullet' | 'explosion' | 'score' | 'gameover' | 'text'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  rotation?: number
  opacity?: number
  color?: string
  text?: string
  id?: string
  fontSize?: number
}

export interface VideoFrame {
  frameId: number
  isKeyframe: boolean
  timestamp: number
  width: number
  height: number
  bitrate: number
  objects: GameObject[]
  inputSequence?: number
}

export interface FECFrame {
  type: 'fec-repair'
  payload: {
    fecGroupId: number
    fecIndex: number
    fecTotal: number
    protectedFrameIds: number[]
    xorObjects: GameObject[]
    width: number
    height: number
  }
}

export interface RetransmittedFrame {
  type: 'retransmitted-frame'
  payload: VideoFrame
}

export interface StreamStatsPayload {
  bitrate: number
  fps: number
  frameId: number
  gameScore: number
  packetLoss: number
  rtt: number
  fecRecovered: number
  nackRecovered: number
  inputLatency: number
}

export type ServerMessage =
  | { type: 'frame'; payload: VideoFrame }
  | { type: 'stats'; payload: StreamStatsPayload }
  | FECFrame
  | RetransmittedFrame

export interface GameInfo {
  id: string
  name: string
  description: string
  thumbnail: string
}

export interface PlayerState {
  x: number
  y: number
  alive: boolean
  lastProcessedInputSeq: number
}

export interface PredictedInput {
  sequence: number
  type: 'left' | 'right' | 'shoot' | 'mouseX'
  value: boolean | number
  timestamp: number
}

export type Language = 'zh' | 'en'

export type QualityLevel = '1080p' | '720p' | '480p'

export interface RecordingFrame {
  frameId: number
  timestamp: number
  objects: GameObject[]
  width: number
  height: number
}

export interface RecordingData {
  startTime: number
  endTime: number
  frames: RecordingFrame[]
  gameScore: number
  quality: QualityLevel
}

export interface QualityInfo {
  level: QualityLevel
  width: number
  height: number
  bitrate: number
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityInfo> = {
  '1080p': { level: '1080p', width: 1920, height: 1080, bitrate: 8000 },
  '720p': { level: '720p', width: 1280, height: 720, bitrate: 4000 },
  '480p': { level: '480p', width: 854, height: 480, bitrate: 2000 },
}
