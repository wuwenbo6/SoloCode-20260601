import { create } from 'zustand'
import type {
  SensorData,
  ConnectionState,
  ControlCommand,
  RobotInfo,
  Obstacle,
  PathPoint,
  RecordingInfo,
} from '@/types'

interface RobotStore {
  connection: ConnectionState
  jointAngles: number[]
  wheelSpeeds: [number, number]
  desiredTorques: number[]
  actualTorques: number[]
  sensorData: SensorData | null
  videoFrame: string
  frameCount: number
  fps: number
  connectionTime: number
  connectionStartTime: number
  fpsTime: number
  ws: WebSocket | null
  robots: RobotInfo[]
  selectedRobotId: string | null
  obstacles: Obstacle[]
  waypoints: PathPoint[]
  targetPoint: PathPoint | null
  autoMode: boolean
  isRecording: boolean
  activeRecordingId: string | null
  recordings: RecordingInfo[]
  isPlaying: boolean
  playbackFrameIndex: number
  playbackFrameData: string
  playbackRecordingId: string | null
  setConnection: (state: Partial<ConnectionState>) => void
  setWS: (ws: WebSocket | null) => void
  updateFromSensorData: (data: SensorData) => void
  updateFromVideoFrame: (data: string) => void
  sendControl: (cmd: Omit<ControlCommand, 'type' | 'timestamp'>) => void
  updateConnectionTime: () => void
  setRobots: (robots: RobotInfo[]) => void
  setSelectedRobot: (robotId: string | null) => void
  setObstacles: (obstacles: Obstacle[]) => void
  setWaypoints: (waypoints: PathPoint[]) => void
  setTargetPoint: (point: PathPoint | null) => void
  setAutoMode: (auto: boolean) => void
  clearPath: () => void
  startRecording: (recordingId: string) => void
  stopRecording: () => void
  setRecordings: (recordings: RecordingInfo[]) => void
  setPlaybackState: (state: {
    isPlaying?: boolean
    playbackFrameIndex?: number
    playbackFrameData?: string
    playbackRecordingId?: string | null
  }) => void
  updateRobotPosition: (robotId: string, position: { x: number; y: number }, heading?: number) => void
}

const initialState = {
  connection: {
    status: 'disconnected' as const,
    latency: 0,
    throughput: 0,
  },
  jointAngles: [0, 0, 0, 0, 0, 0],
  wheelSpeeds: [0, 0] as [number, number],
  desiredTorques: [0, 0, 0, 0, 0, 0],
  actualTorques: [0, 0, 0, 0, 0, 0],
  sensorData: null,
  videoFrame: '',
  frameCount: 0,
  fps: 0,
  connectionTime: 0,
  connectionStartTime: 0,
  fpsTime: 0,
  ws: null,
  robots: [],
  selectedRobotId: null,
  obstacles: [],
  waypoints: [],
  targetPoint: null,
  autoMode: false,
  isRecording: false,
  activeRecordingId: null,
  recordings: [],
  isPlaying: false,
  playbackFrameIndex: 0,
  playbackFrameData: '',
  playbackRecordingId: null,
}

export const useRobotStore = create<RobotStore>((set, get) => ({
  ...initialState,

  setConnection: (state) =>
    set((prev) => ({ connection: { ...prev.connection, ...state } })),

  setWS: (ws) => set({ ws }),

  updateFromSensorData: (data) =>
    set((prev) => {
      const updates: Partial<RobotStore> = {
        sensorData: data,
        actualTorques: data.actualTorques,
        jointAngles: data.jointAngles,
      }
      const existingRobots = [...prev.robots]
      const robotIdx = existingRobots.findIndex((r) => r.id === data.robotId)
      if (robotIdx >= 0) {
        existingRobots[robotIdx] = {
          ...existingRobots[robotIdx],
          position: data.position,
        }
        updates.robots = existingRobots
      }
      return updates
    }),

  updateFromVideoFrame: (data) => {
    const { isPlaying } = get()
    if (isPlaying) return
    const now = Date.now()
    const prev = get()
    const newFrameCount = prev.frameCount + 1
    const fpsNow = Math.floor(1000 / Math.max(1, now - prev.fpsTime))
    set({
      videoFrame: data,
      frameCount: newFrameCount,
      fps: fpsNow > 0 && fpsNow < 60 ? fpsNow : prev.fps,
      fpsTime: now,
    })
  },

  sendControl: (cmd) => {
    const { ws, selectedRobotId } = get()
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg: ControlCommand = {
        type: 'control',
        timestamp: Date.now(),
        robotId: selectedRobotId || undefined,
        ...cmd,
      }
      ws.send(JSON.stringify(msg))
      set({
        wheelSpeeds: [cmd.wheels.leftSpeed, cmd.wheels.rightSpeed],
        desiredTorques: cmd.force.desiredTorques,
        jointAngles: cmd.arm.joints,
      })
    }
  },

  updateConnectionTime: () => {
    const startTime = get().connectionStartTime
    if (startTime > 0) {
      set({ connectionTime: Date.now() - startTime })
    }
  },

  setRobots: (robots) => set({ robots }),

  setSelectedRobot: (robotId) => set({ selectedRobotId: robotId }),

  setObstacles: (obstacles) => set({ obstacles }),

  setWaypoints: (waypoints) => set({ waypoints }),

  setTargetPoint: (point) => set({ targetPoint: point }),

  setAutoMode: (auto) => set({ autoMode: auto }),

  clearPath: () => set({ waypoints: [], targetPoint: null }),

  startRecording: (recordingId) =>
    set({ isRecording: true, activeRecordingId: recordingId }),

  stopRecording: () => set({ isRecording: false, activeRecordingId: null }),

  setRecordings: (recordings) => set({ recordings }),

  setPlaybackState: (state) =>
    set((prev) => {
      const updates: Partial<RobotStore> = {}
      if (state.isPlaying !== undefined) updates.isPlaying = state.isPlaying
      if (state.playbackFrameIndex !== undefined)
        updates.playbackFrameIndex = state.playbackFrameIndex
      if (state.playbackFrameData !== undefined)
        updates.playbackFrameData = state.playbackFrameData
      if (state.playbackRecordingId !== undefined)
        updates.playbackRecordingId = state.playbackRecordingId
      return updates
    }),

  updateRobotPosition: (robotId, position, heading) =>
    set((prev) => {
      const existingRobots = [...prev.robots]
      const robotIdx = existingRobots.findIndex((r) => r.id === robotId)
      if (robotIdx >= 0) {
        existingRobots[robotIdx] = {
          ...existingRobots[robotIdx],
          position,
          heading: heading !== undefined ? heading : existingRobots[robotIdx].heading,
        }
        return { robots: existingRobots }
      }
      return {}
    }),
}))
