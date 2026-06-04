import React from 'react';
import {
  Video,
  VideoOff,
  Circle,
  Square,
  Download,
  Settings,
  Image,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface ControlPanelProps {
  isCameraActive: boolean;
  isRecording: boolean;
  isModelLoaded: boolean;
  onToggleCamera: () => void;
  onToggleRecording: () => void;
  onDownload: () => void;
  onOpenSettings: () => void;
  onToggleBackgroundSelector: () => void;
  onSwitchCamera: () => void;
  onGoToConference?: () => void;
  hasRecording: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isCameraActive,
  isRecording,
  isModelLoaded,
  onToggleCamera,
  onToggleRecording,
  onDownload,
  onOpenSettings,
  onToggleBackgroundSelector,
  onSwitchCamera,
  onGoToConference,
  hasRecording,
}) => {
  const { config } = useAppStore();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pb-6 px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onToggleCamera}
              disabled={isRecording}
              className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                isCameraActive
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
              } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isCameraActive ? (
                <VideoOff className="w-5 h-5" />
              ) : (
                <Video className="w-5 h-5" />
              )}
              <span>{isCameraActive ? '关闭摄像头' : '开启摄像头'}</span>
            </button>

            {isCameraActive && (
              <button
                onClick={onSwitchCamera}
                disabled={isRecording}
                className="p-3 rounded-xl bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-700/50 border border-slate-700/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="切换摄像头"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}

            <div className="w-px h-10 bg-slate-700/50" />

            <button
              onClick={onToggleRecording}
              disabled={!isCameraActive || !isModelLoaded}
              className={`relative flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                isRecording
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                  : 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/40'
              } ${!isCameraActive || !isModelLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRecording ? (
                <Square className="w-5 h-5" />
              ) : (
                <Circle className="w-5 h-5 fill-current" />
              )}
              <span>{isRecording ? '停止录制' : '开始录制'}</span>
              {isRecording && (
                <span className="ml-2 font-mono text-sm opacity-80">
                  {formatTime(useAppStore.getState().recordingTime)}
                </span>
              )}
            </button>

            {hasRecording && (
              <button
                onClick={onDownload}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 font-medium transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                <Download className="w-5 h-5" />
                <span>下载视频</span>
              </button>
            )}

            <div className="w-px h-10 bg-slate-700/50" />

            <button
              onClick={onToggleBackgroundSelector}
              className="p-3 rounded-xl bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-700/50 border border-slate-700/50 transition-all duration-200"
              title="选择背景"
            >
              <Image className="w-5 h-5" />
            </button>

            {onGoToConference && (
              <button
                onClick={onGoToConference}
                className="p-3 rounded-xl bg-purple-500/20 text-purple-400 hover:text-white hover:bg-purple-500/30 border border-purple-500/30 transition-all duration-200"
                title="视频会议"
              >
                <Users className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className="p-3 rounded-xl bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-700/50 border border-slate-700/50 transition-all duration-200"
              title="设置"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-8 text-xs text-slate-500">
            <span>
              分辨率: {config.camera.resolution.toUpperCase()} · 帧率:{' '}
              {config.camera.frameRate}fps
            </span>
            <span>
              模型精度: {config.segmentation.accuracy === 'low' ? '低' : config.segmentation.accuracy === 'medium' ? '中' : '高'}
            </span>
            <span>
              录制码率: {Math.round(config.recording.bitrate / 1000)}kbps
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
