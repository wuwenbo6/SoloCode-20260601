import { useSimulationStore, DisplayMode, ObstacleShape, GridSize } from '../store/useSimulationStore';
import { Play, Pause, RotateCcw, Trash2, Settings, Circle, Square, Grid3X3 } from 'lucide-react';

interface ControlPanelProps {
  onReset: () => void;
  onClearObstacles: () => void;
}

export function ControlPanel({ onReset, onClearObstacles }: ControlPanelProps) {
  const {
    gridSize,
    setGridSize,
    displayMode,
    setDisplayMode,
    obstacleShape,
    setObstacleShape,
    obstacleSize,
    setObstacleSize,
    tau,
    setTau,
    injectionRadius,
    setInjectionRadius,
    injectionDensity,
    setInjectionDensity,
    injectionStrength,
    setInjectionStrength,
    isRunning,
    toggleRunning,
  } = useSimulationStore();

  const gridSizes: { value: GridSize; label: string }[] = [
    { value: 256, label: '256' },
    { value: 512, label: '512' },
  ];

  const displayModes: { value: DisplayMode; label: string }[] = [
    { value: 'velocity', label: 'Velocity' },
    { value: 'density', label: 'Density' },
    { value: 'combined', label: 'Combined' },
  ];

  const obstacleShapes: { value: ObstacleShape; label: string }[] = [
    { value: 'circle', label: 'Circle' },
    { value: 'rectangle', label: 'Square' },
  ];

  return (
    <div className="absolute top-4 right-4 z-10 w-72 bg-slate-900/80 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-500/10 overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-slate-700/50">
        <Settings className="w-4 h-4 text-cyan-400" />
        <h3 className="text-cyan-400 font-mono text-sm font-bold tracking-wide">
          CONTROLS
        </h3>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={toggleRunning}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all ${
              isRunning
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50 hover:bg-orange-500/30'
                : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
            }`}
          >
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isRunning ? 'PAUSE' : 'PLAY'}
          </button>
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg font-mono text-xs font-bold bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-600/50 transition-all"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            onClick={onClearObstacles}
            className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg font-mono text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-2">
            <Grid3X3 className="w-3 h-3 inline mr-1" />
            GRID SIZE
          </label>
          <div className="flex gap-1">
            {gridSizes.map((size) => (
              <button
                key={size.value}
                onClick={() => setGridSize(size.value)}
                className={`flex-1 py-1.5 px-2 rounded-md font-mono text-[10px] font-bold transition-all ${
                  gridSize === size.value
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-700/30 text-slate-400 border border-transparent hover:bg-slate-600/30'
                }`}
              >
                {size.label}×{size.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-2">
            DISPLAY MODE
          </label>
          <div className="flex gap-1">
            {displayModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setDisplayMode(mode.value)}
                className={`flex-1 py-1.5 px-2 rounded-md font-mono text-[10px] font-bold transition-all ${
                  displayMode === mode.value
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-700/30 text-slate-400 border border-transparent hover:bg-slate-600/30'
                }`}
              >
                {mode.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-2">
            OBSTACLE SHAPE
          </label>
          <div className="flex gap-1">
            {obstacleShapes.map((shape) => (
              <button
                key={shape.value}
                onClick={() => setObstacleShape(shape.value)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md font-mono text-[10px] font-bold transition-all ${
                  obstacleShape === shape.value
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-slate-700/30 text-slate-400 border border-transparent hover:bg-slate-600/30'
                }`}
              >
                {shape.value === 'circle' ? (
                  <Circle className="w-3 h-3" />
                ) : (
                  <Square className="w-3 h-3" />
                )}
                {shape.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex justify-between text-xs font-mono text-slate-400 mb-1">
            <span>OBSTACLE SIZE</span>
            <span className="text-purple-300">{obstacleSize}</span>
          </label>
          <input
            type="range"
            min="5"
            max="50"
            value={obstacleSize}
            onChange={(e) => setObstacleSize(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        <div>
          <label className="flex justify-between text-xs font-mono text-slate-400 mb-1">
            <span>VISCOSITY (τ)</span>
            <span className="text-cyan-300">{tau.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={tau}
            onChange={(e) => setTau(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        <div>
          <label className="flex justify-between text-xs font-mono text-slate-400 mb-1">
            <span>INJECT RADIUS</span>
            <span className="text-green-300">{injectionRadius}</span>
          </label>
          <input
            type="range"
            min="5"
            max="30"
            value={injectionRadius}
            onChange={(e) => setInjectionRadius(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-green-500"
          />
        </div>

        <div>
          <label className="flex justify-between text-xs font-mono text-slate-400 mb-1">
            <span>INJECT DENSITY</span>
            <span className="text-yellow-300">{injectionDensity.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={injectionDensity}
            onChange={(e) => setInjectionDensity(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-yellow-500"
          />
        </div>

        <div>
          <label className="flex justify-between text-xs font-mono text-slate-400 mb-1">
            <span>INJECT STRENGTH</span>
            <span className="text-orange-300">{injectionStrength.toFixed(3)}</span>
          </label>
          <input
            type="range"
            min="0.01"
            max="0.3"
            step="0.01"
            value={injectionStrength}
            onChange={(e) => setInjectionStrength(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-orange-500"
          />
        </div>
      </div>

      <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
        <div className="text-[10px] text-slate-500 font-mono space-y-1">
          <div>• <span className="text-slate-400">Move mouse</span> - Inject fluid</div>
          <div>• <span className="text-slate-400">Shift + Drag</span> - Add obstacle</div>
          <div>• <span className="text-slate-400">Right click</span> - Remove obstacle</div>
        </div>
      </div>
    </div>
  );
}
