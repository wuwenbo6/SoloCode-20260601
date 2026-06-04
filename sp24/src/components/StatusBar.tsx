import React from 'react';
import { Loader2, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export const StatusBar: React.FC = () => {
  const {
    fps,
    isModelLoaded,
    isProcessing,
    modelLoadingProgress,
    error,
    config,
  } = useAppStore();

  const formatResolution = () => {
    const { width, height } = {
      '480p': { width: 640, height: 480 },
      '720p': { width: 1280, height: 720 },
      '1080p': { width: 1920, height: 1080 },
    }[config.camera.resolution];
    return `${width}×${height}@${config.camera.frameRate}fps`;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-8 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {isModelLoaded ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-slate-500" />
          )}
          <span className="text-xs text-slate-300 font-mono">
            {isModelLoaded ? '模型已加载' : '模型未加载'}
          </span>
        </div>

        {!isModelLoaded && isProcessing && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            <span className="text-xs text-cyan-400 font-mono">
              加载中 {Math.round(modelLoadingProgress)}%
            </span>
          </div>
        )}

        {isModelLoaded && (
          <span className="text-xs text-slate-400 font-mono">
            {formatResolution()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isModelLoaded && (
          <span
            className={`text-xs font-mono ${fps >= 24 ? 'text-emerald-400' : fps >= 15 ? 'text-amber-400' : 'text-red-400'}`}
          >
            {fps} FPS
          </span>
        )}

        {isProcessing && isModelLoaded && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-xs text-cyan-400 font-mono">处理中</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-mono">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
