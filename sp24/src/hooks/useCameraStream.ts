import { useState, useEffect, useCallback, useRef } from 'react';
import { CameraConfig, RESOLUTION_MAP } from '@/types';

interface UseCameraStreamReturn {
  stream: MediaStream | null;
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
}

export function useCameraStream(config: CameraConfig): UseCameraStreamReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const facingModeRef = useRef(config.facingMode);

  const getConstraints = useCallback(
    (facingMode: 'user' | 'environment'): MediaStreamConstraints => {
      const { width, height } = RESOLUTION_MAP[config.resolution];
      return {
        video: {
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: config.frameRate },
          facingMode,
        },
        audio: true,
      };
    },
    [config.resolution, config.frameRate]
  );

  const createVideoElement = useCallback((): HTMLVideoElement => {
    if (videoRef.current) return videoRef.current;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    videoRef.current = video;
    return video;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      const constraints = getConstraints(facingModeRef.current);
      const mediaStream =
        await navigator.mediaDevices.getUserMedia(constraints);

      const video = createVideoElement();
      video.srcObject = mediaStream;
      await video.play();

      setStream(mediaStream);
      setIsActive(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access camera';
      setError(message);
      setIsActive(false);
    }
  }, [getConstraints, createVideoElement]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, [stream]);

  const switchCamera = useCallback(async () => {
    facingModeRef.current =
      facingModeRef.current === 'user' ? 'environment' : 'user';
    stopCamera();
    await startCamera();
  }, [stopCamera, startCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    stream,
    videoElement: videoRef.current,
    isActive,
    error,
    startCamera,
    stopCamera,
    switchCamera,
  };
}
