import React, { useEffect, useCallback, useRef, useState } from 'react';
import { ArrowLeft, Settings, AlertCircle, Wifi, WifiOff, Users } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useJanusClient } from '@/hooks/useJanusClient';
import { useCanvasComposer } from '@/hooks/useCanvasComposer';
import { useCameraStream } from '@/hooks/useCameraStream';
import { useWebCodecsDecoder } from '@/hooks/useWebCodecsDecoder';
import { useSegmentationWorker } from '@/hooks/useSegmentationWorker';
import { ConferenceGrid } from '@/components/ConferenceGrid';
import { ConferenceControls } from '@/components/ConferenceControls';
import { StatusBar } from '@/components/StatusBar';
import { SettingsModal } from '@/components/SettingsModal';
import { RESOLUTION_MAP, MaskData } from '@/types';

interface ConferencePageProps {
  onBack: () => void;
}

export const ConferencePage: React.FC<ConferencePageProps> = ({ onBack }) => {
  const {
    config,
    isCameraActive,
    isModelLoaded,
    selectedBackground,
    error,
    isConferenceMode,
    setConferenceMode,
    setConferenceParticipants,
    setCameraActive,
    setModelLoaded,
    setError,
    setShowSettings,
    showSettings,
  } = useAppStore();

  const { width, height } = RESOLUTION_MAP[config.camera.resolution];
  const [fps, setFps] = useState(0);
  const [workerFps, setWorkerFps] = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);

  const camera = useCameraStream(config.camera);
  const decoder = useWebCodecsDecoder();
  const worker = useSegmentationWorker();

  const composer = useCanvasComposer({
    width,
    height,
    segmentationConfig: config.segmentation,
  });

  const janus = useJanusClient({
    serverUrl: config.janus.serverUrl,
    roomId: config.janus.roomId,
    displayName: config.janus.displayName,
  });

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const currentMaskRef = useRef<MaskData | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);
  const segmentationFrameCounterRef = useRef<number>(0);

  useEffect(() => {
    setConferenceMode(true);
    return () => {
      setConferenceMode(false);
    };
  }, [setConferenceMode]);

  useEffect(() => {
    worker.onFrameProcessed((mask: MaskData) => {
      currentMaskRef.current = mask;
    });
  }, [worker]);

  useEffect(() => {
    if (worker.currentFps > 0) {
      setWorkerFps(worker.currentFps);
    }
  }, [worker.currentFps]);

  useEffect(() => {
    if (worker.isModelLoaded) {
      setModelLoaded(true);
      setError(null);
    }
  }, [worker.isModelLoaded, setModelLoaded, setError]);

  useEffect(() => {
    if (worker.error) {
      setError(worker.error);
    }
  }, [worker.error, setError]);

  useEffect(() => {
    setConferenceParticipants(janus.participants);
  }, [janus.participants, setConferenceParticipants]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      await camera.startCamera();
      setCameraActive(true);
      worker.loadModel({
        model: config.segmentation.model,
        accuracy: config.segmentation.accuracy,
      });
      worker.updateConfig(config.segmentation);
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法访问摄像头';
      setError(message);
      setCameraActive(false);
    }
  }, [camera, config, worker, setCameraActive, setError]);

  const stopCamera = useCallback(() => {
    camera.stopCamera();
    setCameraActive(false);
    worker.unloadModel();
    setModelLoaded(false);
    composer.clear();
  }, [camera, worker, composer, setCameraActive, setModelLoaded]);

  const joinConference = useCallback(async () => {
    if (!isCameraActive) {
      await startCamera();
    }

    if (!composer.canvas) return;

    const processedStream = composer.getStream(config.camera.frameRate, camera.stream);
    if (!processedStream) {
      setError('无法获取处理后的视频流');
      return;
    }

    const connected = await janus.connect(processedStream);
    if (connected) {
      await janus.publishStream(processedStream);
    }
  }, [composer, config.camera.frameRate, camera.stream, isCameraActive, janus, startCamera, setError]);

  const leaveConference = useCallback(() => {
    janus.disconnect();
  }, [janus]);

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

        if (shouldSegment && isModelLoaded && worker.isWorkerReady) {
          const frame = decoder.isSupported
            ? decoder.decodeFrame(videoElement, timestamp)
            : decoder.decodeFrameFallback(videoElement);

          if (frame) {
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
        const calculatedFps = Math.round(
          frameCountRef.current /
            ((timestamp - lastFpsUpdateRef.current) / 1000)
        );
        setFps(calculatedFps);
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
    ]
  );

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [processFrame]);

  useEffect(() => {
    if (isCameraActive && worker.isWorkerReady) {
      worker.updateConfig(config.segmentation);
    }
  }, [config.segmentation, isCameraActive, worker]);

  useEffect(() => {
    return () => {
      stopCamera();
      leaveConference();
    };
  }, [stopCamera, leaveConference]);

  const localParticipant = janus.participants.find(p => p.isLocal);
  const remoteParticipants = janus.participants.filter(p => !p.isLocal);

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 backdrop-blur-xl rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/80 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 backdrop-blur-xl rounded-xl">
              {janus.isConnected ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <span className="text-sm text-slate-300">
                {janus.isConnected ? '已连接' : '未连接'}
              </span>
            </div>

            {janus.isInRoom && (
              <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 backdrop-blur-xl rounded-xl border border-cyan-500/30">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-cyan-300 font-medium">
                  房间: {config.janus.roomId} ({janus.participants.length} 人)
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {localParticipant && (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 backdrop-blur-xl rounded-xl">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-slate-300">
                  {localParticipant.displayName}
                </span>
              </div>
            )}

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-slate-800/80 backdrop-blur-xl rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/80 transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <StatusBar />
        </div>
      </div>

      {error && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-xl text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <div className="absolute inset-0 pt-36 pb-36">
        {!janus.isConnected && !janus.isInRoom ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <div className="w-32 h-32 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
              <svg className="w-16 h-16 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">加入视频会议</h2>
            <p className="text-slate-400 mb-8 text-center max-w-md">
              将你的视频流上传到 Janus SFU 服务器，与多人进行实时视频会议
            </p>
            <button
              onClick={joinConference}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-2xl font-semibold text-lg hover:from-cyan-400 hover:to-purple-400 transition-all shadow-lg shadow-cyan-500/20"
            >
              加入会议
            </button>
          </div>
        ) : (
          <ConferenceGrid
            participants={janus.participants}
            onParticipantClick={() => setShowParticipants(!showParticipants)}
          />
        )}
      </div>

      <ConferenceControls
        isConnected={janus.isConnected}
        isInRoom={janus.isInRoom}
        participants={janus.participants}
        videoEnabled={localParticipant?.videoEnabled ?? true}
        audioEnabled={localParticipant?.audioEnabled ?? true}
        onToggleVideo={() => janus.toggleVideo(!(localParticipant?.videoEnabled ?? true))}
        onToggleAudio={() => janus.toggleAudio(!(localParticipant?.audioEnabled ?? true))}
        onJoin={joinConference}
        onLeave={leaveConference}
        onOpenSettings={() => setShowSettings(true)}
        onToggleParticipants={() => setShowParticipants(!showParticipants)}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};
