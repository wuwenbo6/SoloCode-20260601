import { useEffect, useRef, useState, useCallback } from 'react';
import {
  detectLowLight,
  applyIlluminationCompensation,
  applyLocalContrastEnhancement,
  smoothSegmentationMask,
  erodeDilateMask,
  type IlluminationState,
} from '@/utils/illumination';

declare global {
  interface Window {
    SelfieSegmentation: any;
  }
}

export function useVirtualBackground(videoStream: MediaStream | null, backgroundImage: string | null) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const segmenterRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const illuminationRef = useRef<IlluminationState>({
    avgLuminance: 0.5,
    gammaFactor: 1.0,
    brightnessBoost: 0,
    needsCompensation: false,
  });
  const prevMaskRef = useRef<Uint8ClampedArray | null>(null);
  const frameCounterRef = useRef(0);

  const loadScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.SelfieSegmentation) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load MediaPipe'));
      document.head.appendChild(script);
    });
  }, []);

  const processFrame = useCallback(() => {
    if (!videoStream || !canvasRef.current || !segmenterRef.current) return;

    const video = document.createElement('video');
    video.srcObject = videoStream;
    video.muted = true;
    video.play();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement('canvas');
    }
    const tempCanvas = tempCanvasRef.current;

    const render = async () => {
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        frameCounterRef.current++;
        const illumination = frameCounterRef.current % 10 === 0
          ? detectLowLight(video, tempCanvas)
          : illuminationRef.current;
        illuminationRef.current = illumination;

        let segmentInput: HTMLVideoElement | HTMLCanvasElement = video;

        if (illumination.needsCompensation) {
          if (!tempCanvasRef.current) {
            tempCanvasRef.current = document.createElement('canvas');
          }
          const compCanvas = tempCanvasRef.current;
          compCanvas.width = video.videoWidth;
          compCanvas.height = video.videoHeight;
          const compCtx = compCanvas.getContext('2d', { willReadFrequently: true })!;
          compCtx.drawImage(video, 0, 0);

          const imageData = compCtx.getImageData(0, 0, compCanvas.width, compCanvas.height);
          const compensated = applyIlluminationCompensation(imageData, illumination);
          applyLocalContrastEnhancement(compensated, illumination);
          compCtx.putImageData(compensated, 0, 0);
          segmentInput = compCanvas;
        }

        const results = await segmenterRef.current.segment({
          image: segmentInput,
        });

        let maskData = results.segmentationMask
          ? ctx.getImageData(0, 0, canvas.width, canvas.height)
          : null;

        if (maskData && results.segmentationMask) {
          ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
          maskData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          if (illumination.needsCompensation) {
            maskData.data.set(
              erodeDilateMask(maskData.data, canvas.width, canvas.height, 1)
            );
            maskData.data.set(
              smoothSegmentationMask(maskData.data, canvas.width, canvas.height)
            );
          }

          if (prevMaskRef.current && prevMaskRef.current.length === maskData.data.length) {
            const blended = new Uint8ClampedArray(maskData.data.length);
            for (let i = 0; i < maskData.data.length; i += 4) {
              const alpha = 0.7;
              blended[i] = Math.round(maskData.data[i] * alpha + prevMaskRef.current[i] * (1 - alpha));
              blended[i + 1] = blended[i];
              blended[i + 2] = blended[i];
              blended[i + 3] = 255;
            }
            prevMaskRef.current = new Uint8ClampedArray(blended);
            maskData.data.set(blended);
          } else {
            prevMaskRef.current = new Uint8ClampedArray(maskData.data);
          }

          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = canvas.width;
          maskCanvas.height = canvas.height;
          const maskCtx = maskCanvas.getContext('2d')!;
          maskCtx.putImageData(maskData, 0, 0);

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (backgroundImage && bgImageRef.current) {
            ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-over';
            ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
          } else {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        } else {
          if (backgroundImage && bgImageRef.current) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } else {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
  }, [videoStream, backgroundImage]);

  useEffect(() => {
    if (!videoStream) return;

    const init = async () => {
      await loadScript();

      const segmenter = new window.SelfieSegmentation({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      segmenter.setOptions({
        modelSelection: 1,
        selfieMode: true,
      });

      await segmenter.initialize();
      segmenterRef.current = segmenter;

      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;

      if (backgroundImage) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = backgroundImage;
        bgImageRef.current = img;
      }

      processFrame();

      const stream = canvas.captureStream(30);
      const audioTrack = videoStream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
      setProcessedStream(stream);
    };

    init();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      segmenterRef.current?.close();
    };
  }, [videoStream, backgroundImage, loadScript, processFrame]);

  return processedStream;
}
