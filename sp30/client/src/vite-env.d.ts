interface WebTransportCloseInfo {
  closeCode?: number;
  reason?: string;
}

interface WebTransportOptions {
  allowPooling?: boolean;
  congestionControl?: 'default' | 'low-latency-throughput' | 'throughput';
  requireUnreliable?: boolean;
  serverCertificateHashes?: Array<{
    algorithm: string;
    value: BufferSource;
  }>;
}

interface WebTransportSendStreamOptions {
  sendOrder?: number;
}

interface WebTransportBidirectionalStream {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

interface WebTransportReceiveStream extends ReadableStream<Uint8Array> {
  readonly streamId?: number;
}

interface WebTransportDatagramSendResult {
  readonly bytesWritten: number;
}

interface WebTransportDatagramStats {
  readonly expiredOutgoing: number;
  readonly droppedIncoming: number;
  readonly lostOutgoing: number;
}

interface WebTransportDatagrams {
  readonly incoming: ReadableStream<Uint8Array>;
  readonly outgoing: WritableStream<Uint8Array>;
  readonly maxDatagramSize: number;
  getStats(): Promise<WebTransportDatagramStats>;
}

declare class WebTransport {
  constructor(url: string, options?: WebTransportOptions);
  
  readonly ready: Promise<undefined>;
  readonly closed: Promise<WebTransportCloseInfo>;
  readonly reliability: 'reliable-only' | 'supports-unreliable';
  readonly congestionControl: 'default' | 'low-latency-throughput' | 'throughput';
  readonly datagrams: WebTransportDatagrams;
  readonly incomingBidirectionalStreams: ReadableStream<WebTransportBidirectionalStream>;
  readonly incomingUnidirectionalStreams: ReadableStream<WebTransportReceiveStream>;
  
  close(closeInfo?: WebTransportCloseInfo): void;
  
  createBidirectionalStream(options?: WebTransportSendStreamOptions): Promise<WebTransportBidirectionalStream>;
  createUnidirectionalStream(options?: WebTransportSendStreamOptions): Promise<WritableStreamDefaultWriter<Uint8Array>>;
}

interface Window {
  WebTransport: typeof WebTransport;
}

declare var VideoEncoder: {
  new(init: VideoEncoderInit): VideoEncoder;
  isConfigSupported(config: VideoEncoderConfig): Promise<{ supported: boolean; config: VideoEncoderConfig }>;
};

declare var VideoDecoder: {
  new(init: VideoDecoderInit): VideoDecoder;
  isConfigSupported(config: VideoDecoderConfig): Promise<{ supported: boolean; config: VideoDecoderConfig }>;
};

interface VideoEncoderInit {
  output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void;
  error: (error: Error) => void;
}

interface VideoDecoderInit {
  output: (frame: VideoFrame) => void;
  error: (error: Error) => void;
}

interface VideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
  latencyMode?: 'realtime' | 'quality' | 'balanced';
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
  alpha?: 'discard' | 'keep';
  scalabilityMode?: string;
  bitrateMode?: 'variable' | 'constant' | 'quantizer';
}

interface VideoDecoderConfig {
  codec: string;
  width?: number;
  height?: number;
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
  description?: AllowSharedBufferSource;
}

interface EncodedVideoChunkMetadata {
  decoderConfig?: VideoDecoderConfig;
  svc?: any;
  alphaSideData?: BufferSource;
}

declare class VideoEncoder {
  readonly state: 'unconfigured' | 'configured' | 'closed';
  readonly encodeQueueSize: number;
  
  configure(config: VideoEncoderConfig): void;
  encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

declare class VideoDecoder {
  readonly state: 'unconfigured' | 'configured' | 'closed';
  readonly decodeQueueSize: number;
  
  configure(config: VideoDecoderConfig): void;
  decode(chunk: EncodedVideoChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

interface EncodedVideoChunkInit {
  type: 'key' | 'delta';
  timestamp: number;
  duration?: number;
  data: AllowSharedBufferSource;
}

declare class EncodedVideoChunk {
  constructor(init: EncodedVideoChunkInit);
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration?: number;
  readonly byteLength: number;
  copyTo(destination: AllowSharedBufferSource): void;
}

declare class VideoFrame {
  constructor(source: CanvasImageSource | VideoFrame, init?: { timestamp?: number; duration?: number });
  readonly format: string;
  readonly codedWidth: number;
  readonly codedHeight: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly timestamp: number;
  readonly duration?: number;
  
  close(): void;
  clone(): VideoFrame;
}
