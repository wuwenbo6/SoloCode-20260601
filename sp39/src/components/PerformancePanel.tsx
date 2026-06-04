import { useSimulationStore } from '../store/useSimulationStore';
import { Activity, Cpu, Gauge } from 'lucide-react';

export function PerformancePanel() {
  const { fps, iterationTime, gpuMemory } = useSimulationStore();

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md rounded-xl p-3 border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-cyan-400" />
        <h3 className="text-cyan-400 font-mono text-sm font-bold tracking-wide">
          PERFORMANCE
        </h3>
      </div>
      
      <div className="space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2 text-slate-400">
            <Gauge className="w-3 h-3" />
            <span>FPS</span>
          </div>
          <span className={`font-bold ${fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
            {fps.toString().padStart(3, '0')}
          </span>
        </div>
        
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-3 h-3" />
            <span>FRAME</span>
          </div>
          <span className="text-cyan-300 font-bold">
            {iterationTime.toFixed(2)} ms
          </span>
        </div>
        
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>VRAM</span>
          </div>
          <span className="text-purple-300 font-bold">
            {gpuMemory.toFixed(2)} MB
          </span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="text-[10px] text-slate-500 font-mono">
          GRID: 256×256 | LBM D2Q9
        </div>
      </div>
    </div>
  );
}
