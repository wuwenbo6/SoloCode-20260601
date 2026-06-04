import React, { useEffect, useRef, useCallback, useState } from 'react';
import { StatusBar } from '@/components/StatusBar';
import { VideoPreview } from '@/components/VideoPreview';
import { ControlPanel } from '@/components/ControlPanel';
import { BackgroundSelector } from '@/components/BackgroundSelector';
import { SettingsModal } from '@/components/SettingsModal';
import { useAppStore } from '@/store/useAppStore';
import { useCameraStream } from '@/hooks/useCameraStream';
import { useWebCodecsDecoder } from '@/hooks/useWebCodecsDecoder';
import { useSegmentationWorker } from '@/hooks/useSegmentationWorker';
import { useCanvasComposer } from '@/hooks/useCanvasComposer';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { MaskData, RESOLUTION_MAP } from '@/types';
import { checkBrowserSupport } from '@/utils/videoUtils';

interface HomeProps {
  onGoToConference?: () => void;
}

const Home: React.FC<HomeProps> = ({ onGoToConference }) => {
  const {
    config,
    isCameraActive,
    isModelLoaded,
    isRecording,
    selectedBackground,
    showSettings,
    showBackgroundSelector,
    recordedVideoUrl,
    setCameraActive,
    setModelLoaded,
    setRecording,
    setProcessing,
    setRecordingTime,
    setFps,
    setError,
    setShowSettings,
    setShowBackgroundSelector,
    setRecordedVideoUrl,
    setStream,
  } = useAppStore();

  const [hasRecording, setHasRecording] = useState(false);

  const camera = useCameraStream(config.camera);
  const decoder = useWebCodecsDecoder();
  const worker = useSegmentationWorker();
  const composer = useCanvasComposer({
    width: RESOLUTION_MAP[config.camera.resolution].width,
    height: RESOLUTION_MAP[config.camera.resolution].height,
    segmentationConfig: config.segmentation,
  });
  const recorder = useMediaRecorder(config.recording);

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const currentMaskRef = useRef<MaskData | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);
  const segmentationFrameCounterRef = useRef<number>(0);

  useEffect(() => {
    const support = checkBrowserSupport();
    if (!support.userMedia) {
      setError('浏览器不支持摄像头访问');
    }
    if (!support.webWorkers) {
      setError('浏览器不支持Web Worker，可能影响性能');
    }
    if (!support.webGL) {
      setError('浏览器不支持WebGL，模型推理会较慢');
    }
  }, [setError]);

  useEffect(() => {
    if (worker.error) {
      setError(worker.error);
    }
  }, [worker.error, setError]);

  useEffect(() => {
    if (recorder.error) {
      setError(recorder.error);
    }
  }, [recorder.error, setError]);

  useEffect(() => {
    if (camera.error) {
      setError(camera.error);
    }
  }, [camera.error, setError]);

  useEffect(() => {
    worker.onFrameProcessed((mask) => {
      currentMaskRef.current = mask;
    });
  }, [worker]);

  useEffect(() => {
    if (worker.currentFps > 0) {
      setFps(worker.currentFps);
    }
  }, [worker.currentFps, setFps]);

  useEffect(() => {
    worker.updateConfig(config.segmentation);
  }, [config.segmentation, worker]);

  useEffect(() => {
    const { width, height } = RESOLUTION_MAP[config.camera.resolution];
    composer.resize(width, height);
  }, [config.camera.resolution, composer]);

  useEffect(() => {
    if (recorder.recordingTime > 0) {
      setRecordingTime(recorder.recordingTime);
    }
  }, [recorder.recordingTime, setRecordingTime]);

  const processFrame = useCallback(
    (timestamp: number) => {
      if (!isCameraActive || !camera.videoElement) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const targetInterval = 1000 / config.camera.frameRate;
      if (timestamp - lastFrameTimeRef.current < targetInterval) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      const videoElement = camera.videoElement;
      if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
        const frameSkip = config.segmentation.frameSkip || 2;
        segmentationFrameCounterRef.current++;

        const shouldSegment =
          segmentationFrameCounterRef.current >= frameSkip;
        if (shouldSegment) {
          segmentationFrameCounterRef.current = 0;
        }

        if (shouldSegment) {
          const frame = decoder.isSupported
            ? decoder.decodeFrame(videoElement, timestamp)
            : decoder.decodeFrameFallback(videoElement);

          if (frame && isModelLoaded && worker.isWorkerReady) {
            worker.processFrame(frame);
          }
        }

        if (selectedBackground) {
          composer.compose(
            videoElement,
            currentMaskRef.current,
            selectedBackground
          );
        }
      }

      frameCountRef.current++;
      if (timestamp - lastFpsUpdateRef.current >= 1000) {
        const fps = Math.round(
          frameCountRef.current /
            ((timestamp - lastFpsUpdateRef.current) / 1000)
        );
        setFps(fps);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    },
    [
      isCameraActive,
      camera.videoElement,
      config.camera.frameRate,
      config.segmentation.frameSkip,
      decoder,
      isModelLoaded,
      worker,
      selectedBackground,
      composer,
      setFps,
    ]
  );

  useEffect(() => {
    if (isCameraActive) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isCameraActive, processFrame]);

  const handleToggleCamera = useCallback(async () => {
    if (!isCameraActive) {
      setError(null);
      setProcessing(true);

      try {
        await camera.startCamera();
        setStream(camera.stream);

        if (!worker.isModelLoaded) {
          await worker.loadModel({
            model: config.segmentation.model,
            accuracy: config.segmentation.accuracy,
          });
        }

        setCameraActive(true);
        setModelLoaded(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start camera';
        setError(message);
        camera.stopCamera();
      } finally {
        setProcessing(false);
      }
    } else {
      if (isRecording) {
        await handleToggleRecording();
      }
      camera.stopCamera();
      setCameraActive(false);
      currentMaskRef.current = null;
      composer.clear();
    }
  }, [
    isCameraActive,
    isRecording,
    camera,
    worker,
    config.segmentation.model,
    config.segmentation.accuracy,
    setError,
    setProcessing,
    setStream,
    setCameraActive,
    setModelLoaded,
    composer,
  ]);

  const handleToggleRecording = useCallback(async () => {
    if (!isRecording) {
      const canvasStream = composer.getStream(config.camera.frameRate, camera.stream);
      if (!canvasStream) {
        setError('无法获取画布流');
        return;
      }

      const hasAudioInStream = canvasStream.getAudioTracks().length > 0;
      await recorder.startRecording(
        canvasStream,
        config.recording.includeAudio && !hasAudioInStream ? camera.stream : null
      );
      setRecording(true);
      setHasRecording(true);
    } else {
      const blob = await recorder.stopRecording();
      if (blob) {
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
      }
      setRecording(false);
    }
  }, [
    isRecording,
    composer,
    config.camera.frameRate,
    config.recording.includeAudio,
    camera.stream,
    recorder,
    setRecording,
    setRecordedVideoUrl,
    setError,
  ]);

  const handleDownload = useCallback(() => {
    recorder.downloadRecording();
  }, [recorder]);

  const handleSwitchCamera = useCallback(async () => {
    await camera.switchCamera();
  }, [camera]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, [setShowSettings]);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, [setShowSettings]);

  const handleToggleBackgroundSelector = useCallback(() => {
    setShowBackgroundSelector(!showBackgroundSelector);
  }, [showBackgroundSelector, setShowBackgroundSelector]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
      camera.stopCamera();
      worker.terminate();
      composer.clear();
    };
  }, [camera, worker, composer, recordedVideoUrl]);

  return (
    <div className="h-full w-full bg-slate-900 grid-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />

      <StatusBar />

      <div className="h-full pt-8">
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gradient mb-2">
              实时人像抠图
            </h1>
            <p className="text-slate-400 text-sm">
              基于WebRTC + WebCodecs + TensorFlow.js + Web Worker
            </p>
          </div>

          <VideoPreview
            canvas={composer.canvas}
            isRecording={isRecording}
            recordingTime={recorder.recordingTime}
          />
        </div>
      </div>

      <ControlPanel
        isCameraActive={isCameraActive}
        isRecording={isRecording}
        isModelLoaded={isModelLoaded}
        onToggleCamera={handleToggleCamera}
        onToggleRecording={handleToggleRecording}
        onDownload={handleDownload}
        onOpenSettings={handleOpenSettings}
        onToggleBackgroundSelector={handleToggleBackgroundSelector}
        onSwitchCamera={handleSwitchCamera}
        onGoToConference={onGoToConference}
        hasRecording={hasRecording || !!recordedVideoUrl}
      />

      <BackgroundSelector
        isOpen={showBackgroundSelector}
        onClose={() => setShowBackgroundSelector(false)}
      />

      <SettingsModal isOpen={showSettings} onClose={handleCloseSettings} />
    </div>
  );
};

export default Home;
