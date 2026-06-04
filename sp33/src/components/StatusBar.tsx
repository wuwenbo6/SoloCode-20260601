import { Activity, Triangle, Clock, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

export function StatusBar() {
  const { renderStats, isLoading } = useAppStore();

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-10 bg-black/60 backdrop-blur-xl border-t border-white/10 flex items-center px-4 gap-6 text-xs z-10">
      {isLoading ? (
        <div className="flex items-center gap-2 text-blue-400">
          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span>加载场景中...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-white/70">
            <Activity className="w-3.5 h-3.5 text-green-400" />
            <span className="text-white/50">采样:</span>
            <span className="font-mono text-white/90">
              {renderStats.currentSample}
            </span>
          </div>

          <div className="flex items-center gap-2 text-white/70">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-white/50">FPS:</span>
            <span className="font-mono text-white/90">{renderStats.fps}</span>
          </div>

          <div className="flex items-center gap-2 text-white/70">
            <Triangle className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-white/50">三角形:</span>
            <span className="font-mono text-white/90">
              {renderStats.triangleCount.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2 text-white/70">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-white/50">光线:</span>
            <span className="font-mono text-white/90">
              {formatNumber(renderStats.rayCount)}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2 text-white/70">
            <span className="text-white/50">渲染时间:</span>
            <span className="font-mono text-white/90">
              {renderStats.renderTime.toFixed(1)}s
            </span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                renderStats.fps > 10
                  ? 'bg-green-500'
                  : renderStats.fps > 5
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              } animate-pulse`}
            />
            <span className="text-white/50">WebGPU</span>
          </div>
        </>
      )}
    </div>
  );
}
