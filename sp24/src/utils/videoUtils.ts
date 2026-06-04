import { RESOLUTION_MAP, Resolution } from '@/types';

export function getResolutionConstraints(resolution: Resolution): {
  width: number;
  height: number;
} {
  return RESOLUTION_MAP[resolution];
}

export async function getVideoFrameFromImageData(
  imageData: ImageData,
  timestamp: number
): Promise<VideoFrame> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  return new VideoFrame(canvas, {
    timestamp,
  });
}

export function readVideoFrameToBuffer(
  frame: VideoFrame
): { buffer: ArrayBuffer; width: number; height: number } {
  const width = frame.displayWidth;
  const height = frame.displayHeight;
  const bufferSize = width * height * 4;
  const buffer = new ArrayBuffer(bufferSize);

  frame.copyTo(new Uint8Array(buffer));

  return { buffer, width, height };
}

export function canvasToImageData(
  canvas: HTMLCanvasElement
): ImageData | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function drawImageDataToCanvas(
  canvas: HTMLCanvasElement,
  imageData: ImageData
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(imageData, 0, 0);
}

export function isWebCodecsSupported(): boolean {
  return typeof VideoFrame !== 'undefined' && typeof VideoDecoder !== 'undefined';
}

export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

export function isUserMediaSupported(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function checkBrowserSupport(): {
  webCodecs: boolean;
  mediaRecorder: boolean;
  userMedia: boolean;
  webWorkers: boolean;
  webGL: boolean;
} {
  return {
    webCodecs: isWebCodecsSupported(),
    mediaRecorder: isMediaRecorderSupported(),
    userMedia: isUserMediaSupported(),
    webWorkers: typeof Worker !== 'undefined',
    webGL: !!document.createElement('canvas').getContext('webgl'),
  };
}
