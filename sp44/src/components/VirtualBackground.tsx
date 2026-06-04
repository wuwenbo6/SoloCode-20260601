import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  detectLowLight,
  applyIlluminationCompensation,
  applyLocalContrastEnhancement,
  smoothSegmentationMask,
  erodeDilateMask,
  type IlluminationState,
} from '@/utils/illumination';

interface VirtualBackgroundProps {
  inputStream: MediaStream | null;
  backgroundImage: string | null;
}

export interface VirtualBackgroundHandle {
  getOutputStream: () => MediaStream | null;
}

const VirtualBackground = forwardRef<VirtualBackgroundHandle, VirtualBackgroundProps>(
  ({ inputStream, backgroundImage }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const outputStreamRef = useRef<MediaStream | null>(null);
    const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const illuminationRef = useRef<IlluminationState>({
      avgLuminance: 0.5,
      gammaFactor: 1.0,
      brightnessBoost: 0,
      needsCompensation: false,
    });
    const prevMaskRef = useRef<Uint8ClampedArray | null>(null);
    const frameCountRef = useRef(0);

    useImperativeHandle(ref, () => ({
      getOutputStream: () => outputStreamRef.current,
    }));

    useEffect(() => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;

      if (inputStream) {
        video.srcObject = inputStream;
        video.play();
      }

      if (!tempCanvasRef.current) {
        tempCanvasRef.current = document.createElement('canvas');
      }

      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      if (backgroundImage) {
        bgImg.src = backgroundImage;
      }

      let animId: number;

      const render = () => {
        if (video.readyState >= 2) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;

          frameCountRef.current++;
          if (frameCountRef.current % 10 === 0 && tempCanvasRef.current) {
            illuminationRef.current = detectLowLight(video, tempCanvasRef.current);
          }

          if (illuminationRef.current.needsCompensation && tempCanvasRef.current) {
            const compCanvas = tempCanvasRef.current;
            compCanvas.width = canvas.width;
            compCanvas.height = canvas.height;
            const compCtx = compCanvas.getContext('2d', { willReadFrequently: true })!;
            compCtx.drawImage(video, 0, 0);

            const imageData = compCtx.getImageData(0, 0, compCanvas.width, compCanvas.height);
            applyIlluminationCompensation(imageData, illuminationRef.current);
            applyLocalContrastEnhancement(imageData, illuminationRef.current);
            compCtx.putImageData(imageData, 0, 0);
          }

          if (backgroundImage && bgImg.complete) {
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } else {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        }
        animId = requestAnimationFrame(render);
      };

      render();

      const stream = canvas.captureStream(30);
      if (inputStream) {
        const audioTrack = inputStream.getAudioTracks()[0];
        if (audioTrack) stream.addTrack(audioTrack);
      }
      outputStreamRef.current = stream;

      return () => {
        cancelAnimationFrame(animId);
        video.pause();
        stream.getTracks().forEach((t) => t.stop());
      };
    }, [inputStream, backgroundImage]);

    return <canvas ref={canvasRef} className="hidden" />;
  },
);

VirtualBackground.displayName = 'VirtualBackground';

export default VirtualBackground;
