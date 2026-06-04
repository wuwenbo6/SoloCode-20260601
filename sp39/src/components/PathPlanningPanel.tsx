import { usePathPlanningStore, Robot } from '../store/usePathPlanningStore';
import { Navigation, Plus, Trash2, Play, Square, MapPin, Flag, Users, Video, Download, X } from 'lucide-react';

export function PathPlanningPanel() {
  const {
    mode,
    setMode,
    robots,
    removeRobot,
    clearRobots,
    pendingStart,
  } = usePathPlanningStore();

  return (
    <div className="absolute top-4 left-4 z-10 w-64 bg-slate-900/80 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-500/10 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-slate-700/50">
        <Navigation className="w-4 h-4 text-cyan-400" />
        <h3 className="text-cyan-400 font-mono text-sm font-bold tracking-wide">
          PATH PLANNING
        </h3>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-2">
            CLICK MODE
          </label>
          <div className="flex gap-1">
            <button
              onClick={() => setMode(mode === 'setStart' ? 'none' : 'setStart')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md font-mono text-[10px] font-bold transition-all ${
                mode === 'setStart'
                  ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                  : 'bg-slate-700/30 text-slate-400 border border-transparent hover:bg-slate-600/30'
              }`}
            >
              <MapPin className="w-3 h-3" />
              START
            </button>
            <button
              onClick={() => setMode(mode === 'setTarget' ? 'none' : 'setTarget')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md font-mono text-[10px] font-bold transition-all ${
                mode === 'setTarget'
                  ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                  : 'bg-slate-700/30 text-slate-400 border border-transparent hover:bg-slate-600/30'
              }`}
            >
              <Flag className="w-3 h-3" />
              TARGET
            </button>
          </div>
        </div>

        {pendingStart && (
          <div className="p-2 rounded-md bg-green-500/10 border border-green-500/30">
            <div className="text-[10px] font-mono text-green-300">
              START SET: ({Math.floor(pendingStart.x)}, {Math.floor(pendingStart.y)})
            </div>
            <div className="text-[9px] font-mono text-green-400/60 mt-0.5">
              Click TARGET to complete...
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-mono text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3" />
              ROBOTS ({robots.length})
            </label>
            {robots.length > 0 && (
              <button
                onClick={clearRobots}
                className="text-[9px] font-mono text-red-400/60 hover:text-red-400 transition-colors"
              >
                CLEAR ALL
              </button>
            )}
          </div>

          {robots.length === 0 ? (
            <div className="text-[10px] font-mono text-slate-600 p-2 bg-slate-800/30 rounded-md text-center">
              Set start & target to add robots
            </div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {robots.map((robot) => (
                <div
                  key={robot.id}
                  className="flex items-center gap-2 p-1.5 rounded-md bg-slate-800/40 border border-slate-700/30"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: robot.color,
                      opacity: robot.arrived ? 0.4 : 1,
                      boxShadow: robot.arrived ? 'none' : `0 0 6px ${robot.color}`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-mono text-slate-300 truncate">
                      {robot.name}
                    </div>
                    <div className="text-[8px] font-mono text-slate-500">
                      {robot.arrived ? 'ARRIVED' : robot.active ? 'MOVING' : 'IDLE'}
                    </div>
                  </div>
                  <button
                    onClick={() => removeRobot(robot.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-2 border-t border-slate-700/50 bg-slate-800/30">
        <div className="text-[9px] text-slate-500 font-mono space-y-0.5">
          <div>• <span className="text-slate-400">Set START</span> then <span className="text-slate-400">TARGET</span></div>
          <div>• <span className="text-slate-400">Robots auto-navigate</span> around obstacles</div>
          <div>• <span className="text-slate-400">Multiple robots</span> path simultaneously</div>
        </div>
      </div>
    </div>
  );
}

interface RecordingPanelProps {
  isRecording: boolean;
  recordedUrl: string | null;
  isPlaying: boolean;
  playbackProgress: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onClearRecording: () => void;
  onStartPlayback: () => void;
  onStopPlayback: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onDownload: () => void;
}

export function RecordingPanel({
  isRecording,
  recordedUrl,
  isPlaying,
  playbackProgress,
  onStartRecording,
  onStopRecording,
  onClearRecording,
  onStartPlayback,
  onStopPlayback,
  videoRef,
  onDownload,
}: RecordingPanelProps) {
  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 w-96 bg-slate-900/80 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-500/10 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-slate-700/50">
        <Video className="w-4 h-4 text-cyan-400" />
        <h3 className="text-cyan-400 font-mono text-sm font-bold tracking-wide">
          RECORDING
        </h3>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex gap-2">
          {!isRecording ? (
            <button
              onClick={onStartRecording}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-mono text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-all"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              REC
            </button>
          ) : (
            <button
              onClick={onStopRecording}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-mono text-xs font-bold bg-red-500/30 text-red-300 border border-red-500/50 hover:bg-red-500/40 transition-all"
            >
              <Square className="w-3 h-3" />
              STOP
            </button>
          )}

          {recordedUrl && (
            <>
              <button
                onClick={isPlaying ? onStopPlayback : onStartPlayback}
                className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg font-mono text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 transition-all"
              >
                {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button
                onClick={onDownload}
                className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg font-mono text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 transition-all"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                onClick={onClearRecording}
                className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg font-mono text-xs font-bold bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-600/50 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-mono text-red-400">RECORDING...</span>
          </div>
        )}

        {isPlaying && recordedUrl && (
          <div>
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-100"
                style={{ width: `${playbackProgress}%` }}
              />
            </div>
            <div className="text-[9px] font-mono text-slate-500 mt-1 text-center">
              PLAYBACK {playbackProgress.toFixed(0)}%
            </div>
          </div>
        )}

        {recordedUrl && (
          <video
            ref={videoRef}
            src={recordedUrl}
            className="w-full rounded-md border border-slate-700/50"
            style={{ maxHeight: '150px', display: isPlaying ? 'block' : 'none' }}
            loop
          />
        )}
      </div>
    </div>
  );
}
