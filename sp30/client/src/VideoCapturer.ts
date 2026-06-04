export interface VideoCapturerOptions {
  onFrame: (frame: VideoFrame) => void;
  width?: number;
  height?: number;
  framerate?: number;
  facingMode?: 'user' | 'environment';
}

export class VideoCapturer {
  private options: VideoCapturerOptions;
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;
  private isRunning = false;
  private lastFrameTime = 0;
  private frameInterval: number;
  private frameCount = 0;
  private actualFramerate = 0;
  private lastFramerateCalc = 0;

  constructor(options: VideoCapturerOptions) {
    this.options = options;
    this.frameInterval = 1000 / (options.framerate ?? 30);
  }

  async start(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: this.options.width ?? 640 },
        height: { ideal: this.options.height ?? 480 },
        frameRate: { ideal: this.options.framerate ?? 30 },
        facingMode: this.options.facingMode ?? 'user',
      },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      await this.videoElement.play();

      this.isRunning = true;
      this.captureLoop();

      console.log('[Capturer] Started with stream:', this.stream);
      return this.stream;
    } catch (err) {
      console.error('[Capturer] Failed to start:', err);
      throw err;
    }
  }

  private captureLoop = (): void => {
    if (!this.isRunning || !this.videoElement) return;

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    if (elapsed >= this.frameInterval) {
      try {
        const frame = new VideoFrame(this.videoElement, {
          timestamp: now * 1000,
        });

        this.options.onFrame(frame);
        this.lastFrameTime = now - (elapsed % this.frameInterval);
        this.frameCount++;
      } catch (err) {
        console.warn('[Capturer] Failed to create frame:', err);
      }
    }

    if (now - this.lastFramerateCalc >= 1000) {
      this.actualFramerate = this.frameCount;
      this.frameCount = 0;
      this.lastFramerateCalc = now;
    }

    this.animationFrameId = requestAnimationFrame(this.captureLoop);
  };

  getStream(): MediaStream | null {
    return this.stream;
  }

  getActualFramerate(): number {
    return this.actualFramerate;
  }

  async setFramerate(framerate: number): Promise<void> {
    this.frameInterval = 1000 / framerate;

    if (this.stream) {
      const track = this.stream.getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({
            frameRate: { ideal: framerate },
          });
          console.log('[Capturer] Framerate updated to:', framerate);
        } catch (err) {
          console.warn('[Capturer] Could not apply framerate constraint:', err);
        }
      }
    }
  }

  async setResolution(width: number, height: number): Promise<void> {
    if (this.stream) {
      const track = this.stream.getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({
            width: { ideal: width },
            height: { ideal: height },
          });
          console.log('[Capturer] Resolution updated to:', width, 'x', height);
        } catch (err) {
          console.warn('[Capturer] Could not apply resolution constraint:', err);
        }
      }
    }
  }

  stop(): void {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    console.log('[Capturer] Stopped');
  }
}
