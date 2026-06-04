interface MediaStreamTrackProcessorInit {
  track: MediaStreamTrack
  maxBufferSize?: number
}

declare class MediaStreamTrackProcessor {
  constructor(init: MediaStreamTrackProcessorInit)
  readonly readable: ReadableStream<VideoFrame>
}

interface VideoEncoderConfig {
  codec: string
  width: number
  height: number
  bitrate?: number
  framerate?: number
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software'
  latencyMode?: 'realtime' | 'quality'
  alpha?: 'discard' | 'keep'
}

interface VideoDecoderConfig {
  codec: string
  codedWidth: number
  codedHeight: number
  optimizeForLatency?: boolean
}

declare class OffscreenCanvas {
  constructor(width: number, height: number)
  width: number
  height: number
  getContext(contextId: '2d', options?: any): OffscreenCanvasRenderingContext2D | null
  transferToImageBitmap(): ImageBitmap
}

interface OffscreenCanvasRenderingContext2D extends CanvasRenderingContext2D {}

declare class VideoEncoder {
  constructor(init: VideoEncoderInit)
  readonly state: 'unconfigured' | 'configured' | 'closed'
  configure(config: VideoEncoderConfig): void
  encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void
  close(): void
  static isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport>
}

interface VideoEncoderInit {
  output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void
  error: (error: Error) => void
}

interface VideoEncoderSupport {
  supported: boolean
}

interface EncodedVideoChunkMetadata {
  decoderConfig?: VideoDecoderConfig
}

declare class VideoDecoder {
  constructor(init: VideoDecoderInit)
  readonly state: 'unconfigured' | 'configured' | 'closed'
  configure(config: VideoDecoderConfig): void
  decode(chunk: EncodedVideoChunk): void
  flush(): Promise<void>
  reset(): void
  close(): void
  static isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport>
}

interface VideoDecoderInit {
  output: (frame: VideoFrame) => void
  error: (error: Error) => void
}

interface VideoDecoderSupport {
  supported: boolean
}

interface VideoFrame {
  readonly displayWidth: number
  readonly displayHeight: number
  readonly codedWidth: number
  readonly codedHeight: number
  readonly timestamp: number
  readonly duration: number | undefined
  constructor(image: CanvasImageSource | OffscreenCanvas, init: { timestamp: number; duration?: number }): VideoFrame
  close(): void
}

declare class EncodedVideoChunk {
  constructor(init: EncodedVideoChunkInit)
  readonly type: 'key' | 'delta'
  readonly timestamp: number
  readonly duration: number | undefined
  readonly byteLength: number
  copyTo(destination: BufferSource): void
}

interface EncodedVideoChunkInit {
  type: 'key' | 'delta'
  timestamp: number
  duration?: number
  data: BufferSource
}

interface DisplayCaptureSurfaceType {
  monitor: string
  window: string
  application: string
  browser: string
}
