import { create } from 'zustand'
import type { Language, QualityLevel, RecordingFrame, QualityInfo } from '../../shared/types'
import { QUALITY_PRESETS } from '../../shared/types'

interface ConnectionState {
  webrtc: 'disconnected' | 'connecting' | 'connected'
  webtransport: 'disconnected' | 'connecting' | 'connected'
}

interface StreamStats {
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

interface TouchLayout {
  joystick: { x: number; y: number }
  buttonA: { x: number; y: number }
  buttonB: { x: number; y: number }
}

interface PassthroughZone {
  x: number
  y: number
  width: number
  height: number
}

interface GameStore {
  connectionState: ConnectionState
  streamStats: StreamStats
  isFullscreen: boolean
  isMuted: boolean
  isTouchDevice: boolean
  touchLayout: TouchLayout
  showOrientationWarning: boolean
  showTouchControls: boolean
  passthroughZones: PassthroughZone[]
  language: Language
  quality: QualityLevel
  qualityInfo: QualityInfo
  isRecording: boolean
  recordingBuffer: RecordingFrame[]
  recordingStartTime: number | null
  recordingDuration: number

  setConnectionState: (state: Partial<ConnectionState>) => void
  setStreamStats: (stats: Partial<StreamStats>) => void
  setFullscreen: (v: boolean) => void
  setMuted: (v: boolean) => void
  setTouchDevice: (v: boolean) => void
  updateTouchLayout: (layout: Partial<TouchLayout>) => void
  setOrientationWarning: (v: boolean) => void
  setShowTouchControls: (v: boolean) => void
  setPassthroughZones: (zones: PassthroughZone[]) => void
  addPassthroughZone: (zone: PassthroughZone) => void
  clearPassthroughZones: () => void
  isPointInPassthroughZone: (x: number, y: number) => boolean
  setLanguage: (lang: Language) => void
  setQuality: (quality: QualityLevel) => void
  toggleRecording: () => void
  startRecording: () => void
  stopRecording: () => void
  addRecordingFrame: (frame: RecordingFrame) => void
  saveHighlight: () => RecordingFrame[]
  clearRecordingBuffer: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  connectionState: { webrtc: 'disconnected', webtransport: 'disconnected' },
  streamStats: { bitrate: 0, fps: 0, frameId: 0, gameScore: 0, packetLoss: 0, rtt: 0, fecRecovered: 0, nackRecovered: 0, inputLatency: 0 },
  isFullscreen: false,
  isMuted: false,
  isTouchDevice: false,
  touchLayout: {
    joystick: { x: 100, y: 300 },
    buttonA: { x: 650, y: 280 },
    buttonB: { x: 650, y: 180 },
  },
  showOrientationWarning: false,
  showTouchControls: true,
  passthroughZones: [],
  language: 'zh',
  quality: '720p',
  qualityInfo: QUALITY_PRESETS['720p'],
  isRecording: false,
  recordingBuffer: [],
  recordingStartTime: null,
  recordingDuration: 0,

  setConnectionState: (state) => set((s) => ({ connectionState: { ...s.connectionState, ...state } })),
  setStreamStats: (stats) => set((s) => ({ streamStats: { ...s.streamStats, ...stats } })),
  setFullscreen: (v) => set({ isFullscreen: v }),
  setMuted: (v) => set({ isMuted: v }),
  setTouchDevice: (v) => set({ isTouchDevice: v }),
  updateTouchLayout: (layout) => set((s) => ({ touchLayout: { ...s.touchLayout, ...layout } })),
  setOrientationWarning: (v) => set({ showOrientationWarning: v }),
  setShowTouchControls: (v) => set({ showTouchControls: v }),
  setPassthroughZones: (zones) => set({ passthroughZones: zones }),
  addPassthroughZone: (zone) => set((s) => ({ passthroughZones: [...s.passthroughZones, zone] })),
  clearPassthroughZones: () => set({ passthroughZones: [] }),
  isPointInPassthroughZone: (x, y) => {
    const { passthroughZones, touchLayout } = get()
    for (const zone of passthroughZones) {
      if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) {
        return true
      }
    }
    const controlSize = 130
    const buttonSize = 72
    const joystickOverlap = x >= touchLayout.joystick.x && x <= touchLayout.joystick.x + controlSize &&
      y >= touchLayout.joystick.y && y <= touchLayout.joystick.y + controlSize
    const buttonAOverlap = x >= touchLayout.buttonA.x && x <= touchLayout.buttonA.x + buttonSize &&
      y >= touchLayout.buttonA.y && y <= touchLayout.buttonA.y + buttonSize
    const buttonBOverlap = x >= touchLayout.buttonB.x && x <= touchLayout.buttonB.x + 64 &&
      y >= touchLayout.buttonB.y && y <= touchLayout.buttonB.y + 64
    return joystickOverlap || buttonAOverlap || buttonBOverlap
  },
  setLanguage: (lang) => set({ language: lang }),
  setQuality: (quality) => set({ quality, qualityInfo: QUALITY_PRESETS[quality] }),
  toggleRecording: () => set((s) => {
    const newIsRecording = !s.isRecording
    return {
      isRecording: newIsRecording,
      recordingStartTime: newIsRecording ? Date.now() : null,
      recordingDuration: newIsRecording ? 0 : s.recordingDuration,
    }
  }),
  startRecording: () => set({
    isRecording: true,
    recordingStartTime: Date.now(),
    recordingDuration: 0,
  }),
  stopRecording: () => set({
    isRecording: false,
    recordingStartTime: null,
  }),
  addRecordingFrame: (frame) => set((s) => {
    const now = Date.now()
    const thirtySecondsAgo = now - 30000
    const filteredBuffer = s.recordingBuffer.filter(f => f.timestamp >= thirtySecondsAgo)
    const newBuffer = [...filteredBuffer, frame]
    return {
      recordingBuffer: newBuffer,
      recordingDuration: s.recordingStartTime ? now - s.recordingStartTime : s.recordingDuration,
    }
  }),
  saveHighlight: () => {
    const { recordingBuffer } = get()
    const now = Date.now()
    const thirtySecondsAgo = now - 30000
    return recordingBuffer.filter(f => f.timestamp >= thirtySecondsAgo)
  },
  clearRecordingBuffer: () => set({
    recordingBuffer: [],
    recordingDuration: 0,
  }),
}))
