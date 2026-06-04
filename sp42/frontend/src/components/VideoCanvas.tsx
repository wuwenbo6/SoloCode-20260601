import { useRef, useEffect, useCallback } from 'react';
import { parseRawRGBAHeader } from '@/hooks/useH264Decoder';

interface VideoCanvasProps {
  onCanvasRef?: (canvas: HTMLCanvasElement | null) => void;
}

export default function VideoCanvas({ onCanvasRef }: VideoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCallbackRef = useRef(onCanvasRef);

  useEffect(() => {
    canvasCallbackRef.current = onCanvasRef;
  }, [onCanvasRef]);

  useEffect(() => {
    if (canvasRef.current && canvasCallbackRef.current) {
      canvasCallbackRef.current(canvasRef.current);
    }
  }, []);

  const drawVideoFrame = useCallback((frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      frame.close();
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      frame.close();
      return;
    }

    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }

    ctx.drawImage(frame, 0, 0);
    frame.close();
  }, []);

  const drawRawRGBA = useCallback((data: Uint8Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parsed = parseRawRGBAHeader(data);
    if (!parsed) return;

    const { width, height, pixels } = parsed;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const imageData = new ImageData(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength), width, height);
    ctx.putImageData(imageData, 0, 0);
  }, []);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { type, data } = e.detail;
      if (type === 'videoFrame') {
        drawVideoFrame(data as VideoFrame);
      } else if (type === 'rawRGBA') {
        drawRawRGBA(data as Uint8Array);
      }
    };
    window.addEventListener('fpv-frame' as string, handler as EventListener);
    return () => {
      window.removeEventListener('fpv-frame' as string, handler as EventListener);
    };
  }, [drawVideoFrame, drawRawRGBA]);

  return (
    <canvas
      ref={(el) => {
        (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
        if (el && canvasCallbackRef.current) {
          canvasCallbackRef.current(el);
        }
      }}
      className="w-full h-full bg-black"
    />
  );
}
