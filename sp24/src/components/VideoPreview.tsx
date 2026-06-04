import React, { useRef, useEffect } from 'react';
import { Play, Pause, Maximize2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface VideoPreviewProps {
  canvas: HTMLCanvasElement | null;
  isRecording: boolean;
  recordingTime: number;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  canvas,
  isRecording,
  recordingTime,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { isCameraActive, isModelLoaded } = useAppStore();

  useEffect(() => {
    if (canvas && canvasContainerRef.current) {
      canvasContainerRef.current.appendChild(canvas);
    }
    return () => {
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [canvas]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center p-8 pt-12 pb-24"
    >
      <div
        ref={canvasContainerRef}
        className="relative rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/20 border border-slate-700/50"
        style={{
          aspectRatio: '16/9',
          maxWidth: 'calc(100vw - 320px)',
          maxHeight: 'calc(100vh - 200px)',
        }}
      >
        {canvas && (
          <canvas
            ref={(el) => {
              if (el && canvas && canvasContainerRef.current) {
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.objectFit = 'cover';
              }
            }}
            className="w-full h-full object-cover"
          />
        )}

        {!isCameraActive && (
          <div className="absolute inset-0 bg-slate-800/90 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full bg-slate-700/50 flex items-center justify-center border border-slate-600">
              <Play className="w-10 h-10 text-slate-400 ml-1" />
            </div>
            <p className="text-slate-400 text-lg font-medium">
              点击下方按钮开启摄像头
            </p>
            <p className="text-slate-500 text-sm">
              我们需要摄像头权限来进行实时抠图处理
            </p>
          </div>
        )}

        {isCameraActive && !isModelLoaded && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
            <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-cyan-400 text-lg font-medium">
              正在加载AI模型...
            </p>
            <p className="text-slate-500 text-sm">
              首次加载可能需要几秒钟，请耐心等待
            </p>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm px-4 py-2 rounded-full">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-white font-bold text-sm font-mono">
              REC {formatTime(recordingTime)}
            </span>
          </div>
        )}

        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            onClick={handleFullscreen}
            className="p-2 bg-slate-900/70 backdrop-blur-sm rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all duration-200"
            title="全屏"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 pointer-events-none" />
      </div>
    </div>
  );
};
