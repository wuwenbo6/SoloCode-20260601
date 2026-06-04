import type { TextOverlayPayload } from './types';

export interface VideoDecoderOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class H264VideoDecoder {
  private decoder: VideoDecoder | null = null;
  private options: VideoDecoderOptions;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private isInitialized = false;
  private waitingForKeyFrame = true;
  private frameCount = 0;
  private textOverlay: TextOverlayPayload | null = null;

  constructor(options: VideoDecoderOptions) {
    this.options = options;
    const ctx = options.canvas.getContext('2d');
    if (ctx) {
      this.canvasCtx = ctx;
    }
  }

  static isSupported(): boolean {
    return 'VideoDecoder' in window;
  }

  static async checkSupport(): Promise<boolean> {
    if (!('VideoDecoder' in window)) {
      return false;
    }

    try {
      const support = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001f',
        width: 640,
        height: 480,
      });
      return support.supported ?? false;
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    if (!H264VideoDecoder.isSupported()) {
      throw new Error('WebCodecs VideoDecoder is not supported in this browser');
    }

    const init: VideoDecoderInit = {
      output: (frame) => {
        this.handleDecodedFrame(frame);
      },
      error: (err) => {
        console.error('[Decoder] Error:', err);
      },
    };

    this.decoder = new VideoDecoder(init);
    this.isInitialized = true;
    this.waitingForKeyFrame = true;
    console.log('[Decoder] Initialized');
  }

  private handleDecodedFrame(frame: VideoFrame): void {
    if (!this.canvasCtx) {
      frame.close();
      return;
    }

    const { canvas } = this.options;
    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }

    this.canvasCtx.drawImage(frame, 0, 0, canvas.width, canvas.height);
    this.drawTextOverlay(this.canvasCtx, canvas.width, canvas.height);
    frame.close();
    this.frameCount++;
  }

  setTextOverlay(overlay: TextOverlayPayload | null): void {
    this.textOverlay = overlay;
    if (overlay && overlay.show) {
      console.log('[Decoder] Text overlay set:', overlay.text);
    }
  }

  private drawTextOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
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
    (ctx as any).roundRect(x, y, totalWidth, totalHeight, 8);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillText(text, x + padding, y + padding);
    ctx.restore();
  }

  decode(data: Uint8Array, timestamp: number, frameType: number): void {
    if (!this.isInitialized || !this.decoder) {
      return;
    }

    if (frameType === 1) {
      this.waitingForKeyFrame = false;
      if (!this.decoder.configure) {
        return;
      }

      const codecConfig: VideoDecoderConfig = {
        codec: 'avc1.42001f',
        width: this.options.width,
        height: this.options.height,
        hardwareAcceleration: 'prefer-software',
      };

      try {
        this.decoder.configure(codecConfig);
      } catch (err) {
        console.warn('[Decoder] Direct config failed, trying with description');
      }
    }

    if (this.waitingForKeyFrame) {
      return;
    }

    try {
      const chunk = new EncodedVideoChunk({
        type: frameType === 1 ? 'key' : 'delta',
        timestamp: timestamp * 1000,
        duration: 0,
        data: data,
      });

      this.decoder.decode(chunk);
    } catch (err) {
      console.error('[Decoder] Failed to decode chunk:', err);
      this.waitingForKeyFrame = true;
    }
  }

  async flush(): Promise<void> {
    if (this.decoder && this.isInitialized) {
      await this.decoder.flush();
    }
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  reset(): void {
    this.waitingForKeyFrame = true;
    this.frameCount = 0;
    if (this.decoder) {
      this.decoder.reset();
    }
  }

  close(): void {
    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }
    this.isInitialized = false;
  }
}
