import React from 'react';
import { PerformanceMetrics } from '../types';

interface PerformanceMonitorProps {
  metrics: PerformanceMetrics;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ metrics }) => {
  const fpsColor = metrics.fps >= 55 ? 'text-green-400' : metrics.fps >= 30 ? 'text-yellow-400' : 'text-red-400';
  const fpsBgColor = metrics.fps >= 55 ? 'bg-green-400' : metrics.fps >= 30 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="fixed top-4 left-4 z-50 font-mono text-xs bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-lg p-4 shadow-2xl shadow-cyan-500/20" style={{ minWidth: '190px' }}>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-cyan-400">FPS</span>
          <span className={'font-bold ' + fpsColor}>{metrics.fps}</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={'h-full transition-all duration-300 ' + fpsBgColor}
            style={{ width: `${Math.min(metrics.fps / 60, 1) * 100}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-cyan-400">计算</span>
          <span className="text-white font-bold">{metrics.particleCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-cyan-400">渲染</span>
          <span className="text-violet-400 font-bold">{metrics.renderedCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-cyan-400">帧时间</span>
          <span className="text-pink-400 font-bold">{metrics.frameTime.toFixed(2)} ms</span>
        </div>
        <div className="pt-1 border-t border-cyan-500/20 mt-1">
          <div style={{ fontSize: '10px' }} className="text-zinc-500">WebGPU &bull; LOD Active</div>
        </div>
      </div>
    </div>
  );
};
