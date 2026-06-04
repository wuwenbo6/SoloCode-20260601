import { SessionRecording } from './SessionRecorder'

type PlaybackStateCallback = (state: PlaybackState) => void

export interface PlaybackState {
  playing: boolean
  currentTime: number
  duration: number
  frameIndex: number
  totalFrames: number
}

export class SessionPlayer {
  private recording: SessionRecording | null = null
  private decoder: VideoDecoder | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private playing: boolean = false
  private paused: boolean = false
  private currentFrameIndex: number = 0
  private startPlaybackTime: number = 0
  private pauseOffset: number = 0
  private animationFrameId: number | null = null
  private playbackSpeed: number = 1.0
  private onStateCallback: PlaybackStateCallback | null = null
  private onEventCallback: ((type: string, payload: any) => void) | null = null
  private lastEventIndex: number = 0

  onStateUpdate(callback: PlaybackStateCallback) {
    this.onStateCallback = callback
  }

  onEvent(callback: (type: string, payload: any) => void) {
    this.onEventCallback = callback
  }

  async load(recording: SessionRecording) {
    this.recording = recording
    this.currentFrameIndex = 0
    this.lastEventIndex = 0
    this.pauseOffset = 0

    if (this.decoder) {
      this.decoder.close()
    }

    this.decoder = new VideoDecoder({
      output: (frame) => {
        if (this.ctx && this.canvas) {
          if (this.canvas.width !== frame.displayWidth || this.canvas.height !== frame.displayHeight) {
            this.canvas.width = frame.displayWidth
            this.canvas.height = frame.displayHeight
          }
          this.ctx.drawImage(frame, 0, 0)
        }
        frame.close()
      },
      error: (error) => {
        console.error('Playback decoder error:', error)
      },
    })

    this.decoder.configure({
      codec: 'avc1.4D401E',
      codedWidth: recording.metadata.width,
      codedHeight: recording.metadata.height,
      optimizeForLatency: false,
    })

    this.emitState()
  }

  mount(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
  }

  play() {
    if (!this.recording || this.playing) return

    this.playing = true
    this.paused = false
    this.startPlaybackTime = performance.now() - this.pauseOffset

    this.tick()
  }

  pause() {
    if (!this.playing) return

    this.playing = false
    this.paused = true
    this.pauseOffset = performance.now() - this.startPlaybackTime

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.emitState()
  }

  seekTo(timeMs: number) {
    if (!this.recording) return

    const frames = this.recording.videoFrames
    let targetIndex = 0
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].timestamp <= timeMs) {
        targetIndex = i
      } else {
        break
      }
    }

    while (targetIndex > 0 && !frames[targetIndex].keyframe) {
      targetIndex--
    }

    this.currentFrameIndex = targetIndex
    this.pauseOffset = timeMs
    this.lastEventIndex = 0

    if (this.playing) {
      this.startPlaybackTime = performance.now() - this.pauseOffset
    }

    this.decodeFrameAtIndex(targetIndex)
    this.emitState()
  }

  setPlaybackSpeed(speed: number) {
    this.playbackSpeed = speed
  }

  getPlaybackSpeed(): number {
    return this.playbackSpeed
  }

  getCurrentTime(): number {
    return this.pauseOffset
  }

  getDuration(): number {
    return this.recording?.metadata.duration ?? 0
  }

  private tick() {
    if (!this.playing || !this.recording) return

    const elapsed = (performance.now() - this.startPlaybackTime) * this.playbackSpeed
    const frames = this.recording.videoFrames

    while (this.currentFrameIndex < frames.length && frames[this.currentFrameIndex].timestamp <= elapsed) {
      this.decodeFrameAtIndex(this.currentFrameIndex)
      this.currentFrameIndex++
    }

    this.processEvents(elapsed)

    this.pauseOffset = elapsed

    if (this.currentFrameIndex >= frames.length) {
      this.playing = false
      this.pauseOffset = this.recording.metadata.duration
      this.emitState()
      return
    }

    this.emitState()
    this.animationFrameId = requestAnimationFrame(() => this.tick())
  }

  private decodeFrameAtIndex(index: number) {
    if (!this.decoder || !this.recording) return
    if (this.decoder.state === 'closed') return

    const frameData = this.recording.videoFrames[index]
    const binaryStr = atob(frameData.data)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    const chunk = new EncodedVideoChunk({
      type: frameData.keyframe ? 'key' : 'delta',
      timestamp: frameData.timestamp,
      duration: frameData.duration,
      data: bytes,
    })

    try {
      if (this.decoder.state === 'configured') {
        this.decoder.decode(chunk)
      }
    } catch (e) {
      console.error('Playback decode error:', e)
    }
  }

  private processEvents(elapsed: number) {
    if (!this.recording) return

    while (this.lastEventIndex < this.recording.events.length) {
      const event = this.recording.events[this.lastEventIndex]
      if (event.timestamp > elapsed) break

      if (this.onEventCallback) {
        this.onEventCallback(event.type, event.payload)
      }
      this.lastEventIndex++
    }
  }

  private emitState() {
    if (this.onStateCallback) {
      this.onStateCallback({
        playing: this.playing,
        currentTime: this.pauseOffset,
        duration: this.recording?.metadata.duration ?? 0,
        frameIndex: this.currentFrameIndex,
        totalFrames: this.recording?.videoFrames.length ?? 0,
      })
    }
  }

  isPlaying() {
    return this.playing
  }

  isPaused() {
    return this.paused
  }

  dispose() {
    this.pause()

    if (this.decoder) {
      this.decoder.close()
      this.decoder = null
    }

    this.recording = null
    this.onStateCallback = null
    this.onEventCallback = null
    this.canvas = null
    this.ctx = null
  }
}
