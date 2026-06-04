import { useCallback, useRef, useEffect } from 'react';
import { FrameData } from '@/types';
import { isWebCodecsSupported } from '@/utils/videoUtils';

interface UseWebCodecsDecoderReturn {
  isSupported: boolean;
  decodeFrame: (
    videoElement: HTMLVideoElement,
    timestamp: number
  ) => FrameData | null;
  decodeFrameFallback: (
    videoElement: HTMLVideoElement
  ) => FrameData | null;
  cleanup: () => void;
}

export function useWebCodecsDecoder(): UseWebCodecsDecoderReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSupported = isWebCodecsSupported();

  const getCanvas = useCallback(
    (width: number, height: number): HTMLCanvasElement => {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      if (
        canvasRef.current.width !== width ||
        canvasRef.current.height !== height
      ) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
      return canvasRef.current;
    },
    []
  );

  const readVideoFrameToBuffer = useCallback(
    (frame: VideoFrame): { buffer: ArrayBuffer; width: number; height: number } => {
      const width = frame.displayWidth;
      const height = frame.displayHeight;
      const bufferSize = width * height * 4;
      const buffer = new ArrayBuffer(bufferSize);

      frame.copyTo(new Uint8Array(buffer));
      frame.close();

      return { buffer, width, height };
    },
    []
  );

  const decodeFrame = useCallback(
    (videoElement: HTMLVideoElement, timestamp: number): FrameData | null => {
      if (!isSupported) return null;

      try {
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;

        if (width === 0 || height === 0) return null;

        const canvas = getCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(videoElement, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);

        return {
          buffer: imageData.data.buffer,
          width,
          height,
          timestamp,
          format: 'RGBA',
        };
      } catch (error) {
        console.error('WebCodecs decode error:', error);
        return null;
      }
    },
    [isSupported, getCanvas]
  );

  const decodeFrameFallback = useCallback(
    (videoElement: HTMLVideoElement): FrameData | null => {
      try {
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;

        if (width === 0 || height === 0) return null;

        const canvas = getCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(videoElement, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);

        return {
          buffer: imageData.data.buffer.slice(0),
          width,
          height,
          timestamp: performance.now(),
          format: 'RGBA',
        };
      } catch (error) {
        console.error('Fallback decode error:', error);
        return null;
      }
    },
    [getCanvas]
  );

  const cleanup = useCallback(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );
      }
      canvasRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isSupported,
    decodeFrame,
    decodeFrameFallback,
    cleanup,
  };
}
