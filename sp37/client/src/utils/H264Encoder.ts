interface EncoderConfig {
  maxWidth: number
  maxHeight: number
  minWidth: number
  minHeight: number
  bitrate: number
  maxFps: number
  minFps: number
}

type ChunkCallback = (chunk: EncodedVideoChunk, meta: any) => void

interface FrameStats {
  encodeTime: number
  frameSize: number
  qp?: number
}

export class H264Encoder {
  private config: EncoderConfig
  private currentWidth: number
  private currentHeight: number
  private currentFps: number
  private encoder: VideoEncoder | null = null
  private onChunkCallback: ChunkCallback | null = null
  private videoTrack: MediaStreamTrack | null = null
  private processor: MediaStreamTrackProcessor | null = null
  private reader: ReadableStreamDefaultReader<VideoFrame> | null = null
  private frameCount: number = 0
  private processedFrames: number = 0
  private droppedFrames: number = 0
  private processing: boolean = false
  private recentStats: FrameStats[] = []
  private targetBitrate: number
  private hardwareFailed: boolean = false
  private adaptiveConfig: {
    qualityThreshold: number
    frameSkipThreshold: number
    scaleDownThreshold: number
    scaleUpThreshold: number
  }

  constructor(config: Partial<EncoderConfig> & { width: number; height: number; framerate?: number }) {
    const aspectRatio = config.width / config.height
    const maxWidth = Math.min(config.width, 1920)
    const maxHeight = Math.round(maxWidth / aspectRatio)
    
    this.config = {
      maxWidth,
      maxHeight,
      minWidth: Math.min(640, maxWidth),
      minHeight: Math.min(360, maxHeight),
      bitrate: config.bitrate || 4_000_000,
      maxFps: config.maxFps || config.framerate || 30,
      minFps: config.minFps || 15,
    }
    
    this.currentWidth = this.config.maxWidth
    this.currentHeight = this.config.maxHeight
    this.currentFps = this.config.maxFps
    this.targetBitrate = this.config.bitrate

    this.adaptiveConfig = {
      qualityThreshold: 100,
      frameSkipThreshold: 50,
      scaleDownThreshold: 3,
      scaleUpThreshold: 10,
    }
  }

  onChunk(callback: ChunkCallback) {
    this.onChunkCallback = callback
  }

  getCurrentStats() {
    return {
      width: this.currentWidth,
      height: this.currentHeight,
      fps: this.currentFps,
      bitrate: this.targetBitrate,
      processedFrames: this.processedFrames,
      droppedFrames: this.droppedFrames,
      avgEncodeTime: this.recentStats.length > 0
        ? this.recentStats.reduce((s, v) => s + v.encodeTime, 0) / this.recentStats.length
        : 0,
    }
  }

  private async tryHardwareEncoding(config: VideoEncoderConfig): Promise<VideoEncoder | null> {
    if (this.hardwareFailed) return null

    try {
      const hwConfig = { ...config, hardwareAcceleration: 'prefer-hardware' as const }
      const support = await VideoEncoder.isConfigSupported(hwConfig)
      
      if (!support.supported) {
        this.hardwareFailed = true
        return null
      }

      const init: VideoEncoderInit = {
        output: (chunk, meta) => {
          if (this.onChunkCallback) {
            this.onChunkCallback(chunk, meta)
          }
        },
        error: (error) => {
          console.warn('Hardware encoder error, falling back to software:', error)
          this.hardwareFailed = true
          if (this.encoder && this.encoder.state !== 'closed') {
            this.encoder.close()
          }
          this.createSoftwareEncoder(config)
        }
      }

      const encoder = new VideoEncoder(init)
      encoder.configure(hwConfig)
      
      console.log('[H264Encoder] Using hardware encoding')
      return encoder
    } catch (e) {
      console.warn('Hardware encoding not available:', e)
      this.hardwareFailed = true
      return null
    }
  }

  private createSoftwareEncoder(config: VideoEncoderConfig) {
    const swConfig = { ...config, hardwareAcceleration: 'no-preference' as const }
    
    const init: VideoEncoderInit = {
      output: (chunk, meta) => {
        if (this.onChunkCallback) {
          this.onChunkCallback(chunk, meta)
        }
      },
      error: (error) => {
        console.error('Software encoder error:', error)
      }
    }

    this.encoder = new VideoEncoder(init)
    this.encoder.configure(swConfig)
    console.log('[H264Encoder] Using software encoding')
  }

  async start(stream: MediaStream) {
    this.videoTrack = stream.getVideoTracks()[0]
    const settings = this.videoTrack.getSettings()
    
    const aspectRatio = (settings.width || 1920) / (settings.height || 1080)
    const sourceMaxWidth = Math.min(settings.width || 1920, this.config.maxWidth)
    this.config.maxWidth = sourceMaxWidth
    this.config.maxHeight = Math.round(sourceMaxWidth / aspectRatio)
    this.currentWidth = this.config.maxWidth
    this.currentHeight = this.config.maxHeight

    const encoderConfig: VideoEncoderConfig = {
      codec: 'avc1.4D401E',
      width: this.currentWidth,
      height: this.currentHeight,
      bitrate: this.targetBitrate,
      framerate: this.currentFps,
      latencyMode: 'realtime',
      alpha: 'discard',
    }

    this.encoder = await this.tryHardwareEncoding(encoderConfig)
    if (!this.encoder) {
      this.createSoftwareEncoder(encoderConfig)
    }

    this.processor = new MediaStreamTrackProcessor({
      track: this.videoTrack
    })

    this.reader = this.processor.readable.getReader()
    this.processing = true
    this.processFrames()
  }

  private shouldDropFrame(): boolean {
    if (this.currentFps >= this.config.maxFps) return false
    
    const skipInterval = Math.round(this.config.maxFps / this.currentFps)
    return (this.frameCount % skipInterval) !== 0
  }

  private addStat(stat: FrameStats) {
    this.recentStats.push(stat)
    if (this.recentStats.length > 30) {
      this.recentStats.shift()
    }
  }

  private checkAdaptiveAdjust() {
    if (this.recentStats.length < 10) return

    const avgEncodeTime = this.recentStats.reduce((s, v) => s + v.encodeTime, 0) / this.recentStats.length
    const slowFrames = this.recentStats.filter(s => s.encodeTime > this.adaptiveConfig.frameSkipThreshold).length

    if (slowFrames >= this.adaptiveConfig.scaleDownThreshold && this.currentWidth > this.config.minWidth) {
      this.scaleDown()
    } else if (avgEncodeTime < this.adaptiveConfig.scaleUpThreshold && this.currentWidth < this.config.maxWidth) {
      this.scaleUp()
    }
  }

  private scaleDown() {
    const newWidth = Math.max(this.config.minWidth, Math.round(this.currentWidth * 0.75))
    const aspectRatio = this.currentWidth / this.currentHeight
    const newHeight = Math.round(newWidth / aspectRatio)
    
    if (newWidth < this.currentWidth) {
      this.currentWidth = newWidth
      this.currentHeight = newHeight
      this.currentFps = Math.max(this.config.minFps, this.currentFps - 5)
      this.targetBitrate = Math.max(1_000_000, Math.round(this.targetBitrate * 0.7))
      this.reconfigureEncoder()
      console.log(`[H264Encoder] Scaled down: ${this.currentWidth}x${this.currentHeight} @ ${this.currentFps}fps`)
    }
  }

  private scaleUp() {
    const newWidth = Math.min(this.config.maxWidth, Math.round(this.currentWidth * 1.25))
    const aspectRatio = this.currentWidth / this.currentHeight
    const newHeight = Math.round(newWidth / aspectRatio)
    
    if (newWidth > this.currentWidth) {
      this.currentWidth = newWidth
      this.currentHeight = newHeight
      this.currentFps = Math.min(this.config.maxFps, this.currentFps + 5)
      this.targetBitrate = Math.min(this.config.bitrate, Math.round(this.targetBitrate * 1.3))
      this.reconfigureEncoder()
      console.log(`[H264Encoder] Scaled up: ${this.currentWidth}x${this.currentHeight} @ ${this.currentFps}fps`)
    }
  }

  private reconfigureEncoder() {
    if (!this.encoder || this.encoder.state === 'closed') return

    try {
      const config: VideoEncoderConfig = {
        codec: 'avc1.4D401E',
        width: this.currentWidth,
        height: this.currentHeight,
        bitrate: this.targetBitrate,
        framerate: this.currentFps,
        latencyMode: 'realtime',
        alpha: 'discard',
        hardwareAcceleration: this.hardwareFailed ? 'no-preference' : 'prefer-hardware',
      }

      this.encoder.configure(config)
      this.frameCount = 0
    } catch (e) {
      console.error('Failed to reconfigure encoder:', e)
    }
  }

  private async processFrames() {
    if (!this.reader || !this.encoder || !this.processing) return

    const offscreenCanvas = new OffscreenCanvas(this.currentWidth, this.currentHeight)
    const offscreenCtx = offscreenCanvas.getContext('2d')

    try {
      while (this.processing) {
        const { value: frame, done } = await this.reader.read()
        
        if (done) break
        if (!frame) continue

        this.frameCount++

        if (this.shouldDropFrame()) {
          this.droppedFrames++
          frame.close()
          continue
        }

        const encodeStart = performance.now()

        if (this.encoder.state === 'configured') {
          let processedFrame = frame

          if (frame.displayWidth !== this.currentWidth || frame.displayHeight !== this.currentHeight) {
            offscreenCanvas.width = this.currentWidth
            offscreenCanvas.height = this.currentHeight
            offscreenCtx?.drawImage(frame, 0, 0, this.currentWidth, this.currentHeight)
            const frameInit: { timestamp: number; duration?: number } = {
              timestamp: frame.timestamp,
            }
            if (frame.duration != null) {
              frameInit.duration = frame.duration
            }
            processedFrame = new VideoFrame(offscreenCanvas, frameInit)
            frame.close()
          }

          const keyFrameEvery = Math.max(30, this.currentFps * 2)
          const keyFrame = this.processedFrames % keyFrameEvery === 0

          this.encoder.encode(processedFrame, { keyFrame })
          this.processedFrames++

          const encodeTime = performance.now() - encodeStart
          this.addStat({ encodeTime, frameSize: 0 })

          if (this.processedFrames % 60 === 0) {
            this.checkAdaptiveAdjust()
          }

          if (processedFrame !== frame) {
            processedFrame.close()
          }
        } else {
          frame.close()
        }
      }
    } catch (error) {
      console.error('Frame processing error:', error)
    }
  }

  stop() {
    this.processing = false

    if (this.reader) {
      this.reader.releaseLock()
      this.reader = null
    }

    if (this.encoder) {
      this.encoder.close()
      this.encoder = null
    }

    this.frameCount = 0
    this.processedFrames = 0
    this.droppedFrames = 0
    this.recentStats = []
  }
}
