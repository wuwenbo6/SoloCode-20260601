import type { EncodingConfig, TextOverlayPayload } from './types';

export interface VideoEncoderOptions {
  config: EncodingConfig;
  onEncodedFrame: (data: Uint8Array, timestamp: number, frameType: number, frameId: number) => void;
  onForceKeyFrame?: () => void;
}

export class H264VideoEncoder {
  private encoder: VideoEncoder | null = null;
  private options: VideoEncoderOptions;
  private config: EncodingConfig;
  private isInitialized = false;
  private frameCount = 0;
  private frameIdCounter = 0;
  private lastKeyFrameTime = 0;
  private currentHardwareMode: 'hardware' | 'software' = 'software';
  private consecutiveErrorCount = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 10;
  private readonly KEY_FRAME_INTERVAL = 60;
  private pendingKeyFrameRequest = false;
  private overlayCanvas: OffscreenCanvas | null = null;
  private overlayCtx: OffscreenCanvasRenderingContext2D | null = null;
  private textOverlay: TextOverlayPayload | null = null;

  constructor(options: VideoEncoderOptions) {
    this.options = options;
    this.config = options.config;
  }

  static isSupported(): boolean {
    return 'VideoEncoder' in window;
  }

  static async checkSupport(): Promise<boolean> {
    if (!('VideoEncoder' in window)) {
      return false;
    }

    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001f',
        width: 640,
        height: 480,
        bitrate: 1000000,
        framerate: 30,
      });
      return support.supported ?? false;
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    if (!H264VideoEncoder.isSupported()) {
      throw new Error('WebCodecs VideoEncoder is not supported in this browser');
    }

    const init: VideoEncoderInit = {
      output: (chunk, metadata) => {
        this.handleEncodedChunk(chunk, metadata);
      },
      error: (err) => {
        this.handleEncoderError(err);
      },
    };

    this.encoder = new VideoEncoder(init);

    await this.configureWithFallback();

    this.isInitialized = true;
    console.log(`[Encoder] Initialized with ${this.currentHardwareMode} encoding, config:`, this.config);
  }

  private async configureWithFallback(): Promise<void> {
    if (!this.encoder) return;

    const codecConfigs: Array<{ config: VideoEncoderConfig; name: string }> = [
      {
        config: {
          codec: 'avc1.42001f',
          width: this.config.width,
          height: this.config.height,
          bitrate: this.config.bitrate,
          framerate: this.config.framerate,
          latencyMode: 'realtime',
          hardwareAcceleration: 'prefer-hardware',
        },
        name: 'hardware (avc1.42001f)',
      },
      {
        config: {
          codec: 'avc1.4d001f',
          width: this.config.width,
          height: this.config.height,
          bitrate: this.config.bitrate,
          framerate: this.config.framerate,
          latencyMode: 'realtime',
          hardwareAcceleration: 'prefer-hardware',
        },
        name: 'hardware (avc1.4d001f)',
      },
      {
        config: {
          codec: 'avc1.42001f',
          width: this.config.width,
          height: this.config.height,
          bitrate: this.config.bitrate,
          framerate: this.config.framerate,
          latencyMode: 'realtime',
          hardwareAcceleration: 'no-preference',
        },
        name: 'no-preference (avc1.42001f)',
      },
      {
        config: {
          codec: 'avc1.42001f',
          width: this.config.width,
          height: this.config.height,
          bitrate: this.config.bitrate,
          framerate: this.config.framerate,
          latencyMode: 'realtime',
          hardwareAcceleration: 'prefer-software',
        },
        name: 'software (avc1.42001f)',
      },
    ];

    for (const { config, name } of codecConfigs) {
      try {
        console.log(`[Encoder] Trying ${name}...`);
        const support = await VideoEncoder.isConfigSupported(config);

        if (support.supported ?? false) {
          this.encoder.configure(config);

          await this.waitForConfigured();

          this.currentHardwareMode = name.includes('hardware') ? 'hardware' : 'software';
          console.log(`[Encoder] Successfully configured with ${name}`);
          return;
        } else {
          console.log(`[Encoder] ${name} not supported, trying next...`);
        }
      } catch (err) {
        console.warn(`[Encoder] ${name} failed:`, err);
      }
    }

    throw new Error('No H.264 encoding configuration supported on this device');
  }

  private async waitForConfigured(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Encoder configuration timeout'));
      }, 3000);

      const checkState = () => {
        if (this.encoder?.state === 'configured') {
          clearTimeout(timeout);
          resolve();
        } else if (this.encoder?.state === 'closed') {
          clearTimeout(timeout);
          reject(new Error('Encoder closed during configuration'));
        } else {
          setTimeout(checkState, 10);
        }
      };

      checkState();
    });
  }

  private async handleEncoderError(err: Error): Promise<void> {
    console.error('[Encoder] Error:', err);
    this.consecutiveErrorCount++;

    if (this.consecutiveErrorCount >= this.MAX_CONSECUTIVE_ERRORS) {
      console.warn(`[Encoder] Too many consecutive errors (${this.consecutiveErrorCount}), attempting recovery...`);

      try {
        if (this.currentHardwareMode === 'hardware') {
          console.log('[Encoder] Falling back to software encoding...');
          this.currentHardwareMode = 'software';

          if (this.encoder) {
            this.encoder.close();
          }

          const init: VideoEncoderInit = {
            output: (chunk, metadata) => {
              this.handleEncodedChunk(chunk, metadata);
            },
            error: (e) => {
              this.handleEncoderError(e);
            },
          };

          this.encoder = new VideoEncoder(init);
          await this.configureWithFallback();
          this.consecutiveErrorCount = 0;
        }
      } catch (recoveryErr) {
        console.error('[Encoder] Recovery failed:', recoveryErr);
      }
    }
  }

  forceKeyFrame(): void {
    this.pendingKeyFrameRequest = true;
    this.options.onForceKeyFrame?.();
    console.log('[Encoder] Key frame requested');
  }

  setTextOverlay(overlay: TextOverlayPayload | null): void {
    this.textOverlay = overlay;
    if (overlay && overlay.show) {
      console.log('[Encoder] Text overlay set:', overlay.text);
    }
  }

  private ensureOverlayCanvas(width: number, height: number): void {
    if (!this.overlayCanvas || this.overlayCanvas.width !== width || this.overlayCanvas.height !== height) {
      this.overlayCanvas = new OffscreenCanvas(width, height);
      this.overlayCtx = this.overlayCanvas.getContext('2d');
    }
  }

  private drawTextOverlay(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number): void {
    if (!this.textOverlay || !this.textOverlay.show || !this.textOverlay.text) {
      return;
    }

    const { text, position, font_size, color, background_color } = this.textOverlay;

    ctx.save();
    ctx.font = `bold ${font_size}px Arial, sans-serif`;
    ctx.textBaseline = 'top';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = font_size * 1.4;
    const padding = 12;

    let x = 0, y = 0;
    const totalWidth = textWidth + padding * 2;
    const totalHeight = textHeight + padding * 2;

    switch (position) {
      case 'top-left':
        x = 20; y = 20;
        break;
      case 'top-right':
        x = width - totalWidth - 20; y = 20;
        break;
      case 'bottom-left':
        x = 20; y = height - totalHeight - 20;
        break;
      case 'bottom-right':
        x = width - totalWidth - 20; y = height - totalHeight - 20;
        break;
      case 'center':
        x = (width - totalWidth) / 2; y = (height - totalHeight) / 2;
        break;
    }

    ctx.fillStyle = background_color;
    ctx.beginPath();
    ctx.roundRect(x, y, totalWidth, totalHeight, 8);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillText(text, x + padding, y + padding);
    ctx.restore();
  }

  private handleEncodedChunk(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): void {
    this.consecutiveErrorCount = 0;

    const byteLength = chunk.byteLength;
    const data = new Uint8Array(byteLength);
    chunk.copyTo(data);

    const frameType = chunk.type === 'key' ? 1 : 0;
    const frameId = this.frameIdCounter++;

    let finalData = data;

    if (frameType === 1 && metadata?.decoderConfig?.description) {
      const desc = metadata.decoderConfig.description as ArrayBuffer;
      const descBytes = new Uint8Array(desc);

      const combined = new Uint8Array(descBytes.length + data.length);
      combined.set(descBytes);
      combined.set(data, descBytes.length);

      finalData = combined;
    }

    this.options.onEncodedFrame(finalData, chunk.timestamp ?? Date.now(), frameType, frameId);
    this.frameCount++;
  }

  encodeFrame(frame: VideoFrame): void {
    if (!this.isInitialized || !this.encoder) {
      frame.close();
      return;
    }

    const now = Date.now();
    const needKeyFrame = this.pendingKeyFrameRequest ||
                        this.frameCount === 0 ||
                        (now - this.lastKeyFrameTime) > (this.KEY_FRAME_INTERVAL * 1000 / this.config.framerate);

    if (needKeyFrame) {
      this.lastKeyFrameTime = now;
      this.pendingKeyFrameRequest = false;
    }

    try {
      if (this.encoder.encodeQueueSize > 30) {
        console.warn(`[Encoder] Queue overflow (${this.encoder.encodeQueueSize}), dropping frame`);
        frame.close();
        return;
      }

      let frameToEncode = frame;

      if (this.textOverlay && this.textOverlay.show && this.textOverlay.text) {
        const width = frame.displayWidth;
        const height = frame.displayHeight;

        this.ensureOverlayCanvas(width, height);

        if (this.overlayCtx) {
          this.overlayCtx.drawImage(frame, 0, 0, width, height);
          this.drawTextOverlay(this.overlayCtx, width, height);

          const newFrame = new VideoFrame(this.overlayCanvas!, {
            timestamp: frame.timestamp ?? 0,
            duration: frame.duration ?? 0,
          });

          frame.close();
          frameToEncode = newFrame;
        }
      }

      this.encoder.encode(frameToEncode, {
        keyFrame: needKeyFrame,
      });
      frameToEncode.close();
    } catch (err) {
      console.error('[Encoder] Failed to encode frame:', err);
      frame.close();
      this.handleEncoderError(err as Error);
    }
  }

  async updateConfig(newConfig: Partial<EncodingConfig>): Promise<void> {
    if (!this.encoder) return;

    this.config = { ...this.config, ...newConfig };

    if (this.isInitialized) {
      try {
        await this.encoder.flush();
      } catch (e) {
        console.warn('[Encoder] Flush error during config update:', e);
      }
    }

    try {
      const codecConfig: VideoEncoderConfig = {
        codec: 'avc1.42001f',
        width: this.config.width,
        height: this.config.height,
        bitrate: this.config.bitrate,
        framerate: this.config.framerate,
        latencyMode: 'realtime',
        hardwareAcceleration: this.currentHardwareMode === 'hardware' ? 'prefer-hardware' : 'prefer-software',
      };

      this.encoder.configure(codecConfig);
      console.log(`[Encoder] Config updated (${this.currentHardwareMode}):`, this.config);

      this.forceKeyFrame();
    } catch (err) {
      console.error('[Encoder] Failed to reconfigure, attempting fallback:', err);
      try {
        await this.configureWithFallback();
      } catch (fallbackErr) {
        console.error('[Encoder] Fallback failed during reconfigure:', fallbackErr);
      }
    }
  }

  getConfig(): EncodingConfig {
    return { ...this.config };
  }

  getHardwareMode(): string {
    return this.currentHardwareMode;
  }

  getEncodeQueueSize(): number {
    return this.encoder?.encodeQueueSize ?? 0;
  }

  async flush(): Promise<void> {
    if (this.encoder && this.isInitialized) {
      try {
        await this.encoder.flush();
      } catch (e) {
        console.warn('[Encoder] Flush error:', e);
      }
    }
  }

  close(): void {
    if (this.encoder) {
      this.encoder.close();
      this.encoder = null;
    }
    this.isInitialized = false;
    this.consecutiveErrorCount = 0;
  }
}
