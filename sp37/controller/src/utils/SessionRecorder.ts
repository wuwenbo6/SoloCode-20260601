interface RecordedVideoFrame {
  timestamp: number
  duration: number
  keyframe: boolean
  data: string
}

interface RecordedEvent {
  timestamp: number
  type: string
  payload: any
}

export interface SessionRecording {
  version: number
  startTime: number
  endTime: number
  videoFrames: RecordedVideoFrame[]
  events: RecordedEvent[]
  metadata: {
    width: number
    height: number
    fps: number
    duration: number
  }
}

export class SessionRecorder {
  private recording: boolean = false
  private startTime: number = 0
  private videoFrames: RecordedVideoFrame[] = []
  private events: RecordedEvent[] = []
  private width: number = 1920
  private height: number = 1080
  private fps: number = 0
  private frameCount: number = 0
  private maxRecordingDurationMs: number = 30 * 60 * 1000

  start(width: number, height: number) {
    this.recording = true
    this.startTime = performance.now()
    this.videoFrames = []
    this.events = []
    this.width = width
    this.height = height
    this.fps = 0
    this.frameCount = 0
  }

  stop(): SessionRecording | null {
    if (!this.recording) return null
    this.recording = false

    const duration = performance.now() - this.startTime
    this.fps = this.frameCount > 0 ? Math.round(this.frameCount / (duration / 1000)) : 0

    return {
      version: 1,
      startTime: this.startTime,
      endTime: performance.now(),
      videoFrames: this.videoFrames,
      events: this.events,
      metadata: {
        width: this.width,
        height: this.height,
        fps: this.fps,
        duration,
      },
    }
  }

  recordVideoFrame(data: Uint8Array, timestamp: number, duration: number | undefined, keyframe: boolean) {
    if (!this.recording) return

    const elapsed = timestamp - this.startTime
    if (elapsed > this.maxRecordingDurationMs) return

    let binary = ''
    const bytes = new Uint8Array(data)
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }

    this.videoFrames.push({
      timestamp: elapsed,
      duration: duration ?? 0,
      keyframe,
      data: btoa(binary),
    })
    this.frameCount++
  }

  recordEvent(type: string, payload: any) {
    if (!this.recording) return

    this.events.push({
      timestamp: performance.now() - this.startTime,
      type,
      payload,
    })
  }

  isRecording() {
    return this.recording
  }

  getFrameCount() {
    return this.frameCount
  }

  getEventCount() {
    return this.events.length
  }

  getDurationMs() {
    if (!this.recording) return 0
    return performance.now() - this.startTime
  }

  static exportToFile(recording: SessionRecording, filename: string) {
    const json = JSON.stringify(recording)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  static async loadFromFile(file: File): Promise<SessionRecording> {
    const text = await file.text()
    return JSON.parse(text) as SessionRecording
  }
}
