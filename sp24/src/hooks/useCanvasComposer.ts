import { useRef, useEffect, useCallback } from 'react';
import { Background, MaskData, SegmentationConfig } from '@/types';
import {
  drawBackground,
  getImageDataFromBuffer,
  createCanvas,
} from '@/utils/canvasUtils';

interface UseCanvasComposerOptions {
  width: number;
  height: number;
  segmentationConfig: SegmentationConfig;
}

interface UseCanvasComposerReturn {
  canvas: HTMLCanvasElement | null;
  context: CanvasRenderingContext2D | null;
  compose: (
    videoElement: HTMLVideoElement,
    mask: MaskData | null,
    background: Background
  ) => void;
  getStream: (frameRate: number, audioStream?: MediaStream | null) => MediaStream | null;
  resize: (width: number, height: number) => void;
  clear: () => void;
}

export function useCanvasComposer(
  options: UseCanvasComposerOptions
): UseCanvasComposerReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const foregroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ width: options.width, height: options.height });
  const configRef = useRef(options.segmentationConfig);

  useEffect(() => {
    configRef.current = options.segmentationConfig;
  }, [options.segmentationConfig]);

  useEffect(() => {
    const canvas = createCanvas(options.width, options.height);
    const ctx = canvas.getContext('2d');
    const foregroundCanvas = createCanvas(options.width, options.height);
    const maskCanvas = createCanvas(options.width, options.height);

    canvasRef.current = canvas;
    ctxRef.current = ctx;
    foregroundCanvasRef.current = foregroundCanvas;
    maskCanvasRef.current = maskCanvas;
    sizeRef.current = { width: options.width, height: options.height };

    return () => {
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvasRef.current = null;
      ctxRef.current = null;
      foregroundCanvasRef.current = null;
      maskCanvasRef.current = null;
    };
  }, [options.width, options.height]);

  const compose = useCallback(
    (
      videoElement: HTMLVideoElement,
      mask: MaskData | null,
      background: Background
    ) => {
      const ctx = ctxRef.current;
      const foregroundCanvas = foregroundCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!ctx || !foregroundCanvas || !maskCanvas) return;

      const { width, height } = sizeRef.current;

      const fgCtx = foregroundCanvas.getContext('2d');
      if (!fgCtx) return;

      fgCtx.clearRect(0, 0, width, height);
      fgCtx.drawImage(videoElement, 0, 0, width, height);

      drawBackground(ctx, background, width, height, videoElement);

      if (mask) {
        try {
          const maskImageData = getImageDataFromBuffer(
            mask.buffer.slice(0),
            mask.width,
            mask.height
          );

          const maskCtx = maskCanvas.getContext('2d')!;
          maskCtx.clearRect(0, 0, width, height);
          maskCtx.putImageData(maskImageData, 0, 0);

          fgCtx.globalCompositeOperation = 'destination-in';
          fgCtx.drawImage(maskCanvas, 0, 0, width, height);
          fgCtx.globalCompositeOperation = 'source-over';

          ctx.drawImage(foregroundCanvas, 0, 0, width, height);
        } catch (error) {
          console.error('Composition error:', error);
          ctx.drawImage(videoElement, 0, 0, width, height);
        }
      } else {
        ctx.drawImage(videoElement, 0, 0, width, height);
      }
    },
    []
  );

  const getStream = useCallback(
    (frameRate: number, audioStream?: MediaStream | null): MediaStream | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      try {
        const stream = (canvas as HTMLCanvasElement & {
          captureStream: (frameRate: number) => MediaStream;
        }).captureStream(frameRate);

        if (audioStream) {
          audioStream.getAudioTracks().forEach((track) => {
            stream.addTrack(track);
          });
        }

        return stream;
      } catch (error) {
        console.error('Failed to get canvas stream:', error);
        return null;
      }
    },
    []
  );

  const resize = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;
    const foregroundCanvas = foregroundCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;

    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
    if (foregroundCanvas) {
      foregroundCanvas.width = width;
      foregroundCanvas.height = height;
    }
    if (maskCanvas) {
      maskCanvas.width = width;
      maskCanvas.height = height;
    }

    sizeRef.current = { width, height };
  }, []);

  const clear = useCallback(() => {
    const ctx = ctxRef.current;
    const { width, height } = sizeRef.current;

    if (ctx) {
      ctx.clearRect(0, 0, width, height);
    }
  }, []);

  return {
    canvas: canvasRef.current,
    context: ctxRef.current,
    compose,
    getStream,
    resize,
    clear,
  };
}
