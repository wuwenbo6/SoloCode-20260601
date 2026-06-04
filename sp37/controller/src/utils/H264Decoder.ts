interface DecoderConfig {
  width: number
  height: number
}

type FrameCallback = (frame: VideoFrame) => void

interface DecodeStats {
  decodedFrames: number
  droppedFrames: number
  avgDecodeTime: number
  pendingFrames: number
}

export class H264Decoder {
  private config: DecoderConfig
  private decoder: VideoDecoder | null = null
  private onFrameCallback: FrameCallback | null = null
  private initialized: boolean = false
  private maxQueueSize: number = 2
  private stats: DecodeStats = {
    decodedFrames: 0,
    droppedFrames: 0,
    avgDecodeTime: 0,
    pendingFrames: 0,
  }
  private recentDecodeTimes: number[] = []
  private lastKeyFrameAt: number = 0
  private waitingForKeyFrame: boolean = false

  constructor(config: DecoderConfig) {
    this.config = config
  }

  onFrame(callback: FrameCallback) {
    this.onFrameCallback = callback
  }

  getStats(): DecodeStats {
    return { ...this.stats }
  }

  async init() {
    const decoderConfig: VideoDecoderConfig = {
      codec: 'avc1.4D401E',
      codedWidth: this.config.width,
      codedHeight: this.config.height,
      optimizeForLatency: true,
    }

    const support = await VideoDecoder.isConfigSupported(decoderConfig)
    if (!support.supported) {
      throw new Error('H.264 decoding not supported')
    }

    this.decoder = new VideoDecoder({
      output: (frame) => {
        const decodeTime = performance.now() - this.lastKeyFrameAt
        this.addDecodeTime(decodeTime)
        this.stats.decodedFrames++
        this.stats.pendingFrames = this.decoder?.decodeQueueSize ?? 0

        if (this.onFrameCallback) {
          this.onFrameCallback(frame)
        } else {
          frame.close()
        }
      },
      error: (error) => {
        console.error('Video decoder error:', error)
        this.waitingForKeyFrame = true
      }
    })

    this.decoder.configure(decoderConfig)
    this.initialized = true
    this.waitingForKeyFrame = true
  }

  private addDecodeTime(time: number) {
    this.recentDecodeTimes.push(time)
    if (this.recentDecodeTimes.length > 30) {
      this.recentDecodeTimes.shift()
    }
    this.stats.avgDecodeTime = this.recentDecodeTimes.length > 0
      ? this.recentDecodeTimes.reduce((s, v) => s + v, 0) / this.recentDecodeTimes.length
      : 0
  }

  decode(data: Uint8Array, timestamp: number, duration: number | undefined, keyframe: boolean) {
    if (!this.decoder || !this.initialized) return
    if (this.decoder.state === 'closed') return

    if (keyframe) {
      this.lastKeyFrameAt = performance.now()
      this.waitingForKeyFrame = false
    }

    if (this.waitingForKeyFrame && !keyframe) {
      this.stats.droppedFrames++
      return
    }

    const queueSize = this.decoder.decodeQueueSize
    if (queueSize >= this.maxQueueSize) {
      this.stats.droppedFrames++
      return
    }

    const chunk = new EncodedVideoChunk({
      type: keyframe ? 'key' : 'delta',
      timestamp,
      duration: duration ?? 0,
      data,
    })

    if (this.decoder.state === 'configured') {
      try {
        this.decoder.decode(chunk)
      } catch (e) {
        console.error('Decode error:', e)
        this.waitingForKeyFrame = true
      }
    }
  }

  async flush() {
    if (this.decoder && this.decoder.state === 'configured') {
      try {
        await this.decoder.flush()
      } catch (e) {
        console.error('Flush error:', e)
      }
    }
  }

  reset() {
    if (this.decoder) {
      this.decoder.reset()
      this.decoder.configure({
        codec: 'avc1.4D401E',
        codedWidth: this.config.width,
        codedHeight: this.config.height,
        optimizeForLatency: true,
      })
      this.waitingForKeyFrame = true
    }
  }

  updateConfig(width: number, height: number) {
    if (this.config.width === width && this.config.height === height) return

    this.config.width = width
    this.config.height = height
    
    if (this.decoder && this.initialized) {
      try {
        this.decoder.reset()
        this.decoder.configure({
          codec: 'avc1.4D401E',
          codedWidth: this.config.width,
          codedHeight: this.config.height,
          optimizeForLatency: true,
        })
        this.waitingForKeyFrame = true
        console.log(`[H264Decoder] Resolution updated: ${width}x${height}`)
      } catch (e) {
        console.error('Failed to update decoder config:', e)
      }
    }
  }

  stop() {
    if (this.decoder) {
      this.decoder.close()
      this.decoder = null
      this.initialized = false
    }
    this.stats = {
      decodedFrames: 0,
      droppedFrames: 0,
      avgDecodeTime: 0,
      pendingFrames: 0,
    }
  }

  isInitialized() {
    return this.initialized
  }

  getState(): string {
    return this.decoder?.state ?? 'unconfigured'
  }
}
