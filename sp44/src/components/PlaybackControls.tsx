import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

interface TimelineProps {
  currentTime: number;
  duration: number;
  buffered?: number;
  onSeek: (time: number) => void;
}

export default function Timeline({ currentTime, duration, buffered = 0, onSeek }: TimelineProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className="w-full px-4 py-2">
      <div
        className="relative h-2 bg-white/10 rounded-full cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          onSeek(percent * duration);
        }}
      >
        <div
          className="absolute h-full bg-white/30 rounded-full"
          style={{ width: `${bufferedProgress}%` }}
        />
        <div
          className="absolute h-full bg-[#00e5a0] rounded-full"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#00e5a0] rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-white/60 text-xs font-mono">{formatTime(currentTime)}</span>
        <span className="text-white/60 text-xs font-mono">{formatTime(duration)}</span>
      </div>
    </div>
  );
}

interface PlaybackControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  onPlayPause: () => void;
  onVolumeToggle: () => void;
  onVolumeChange: (volume: number) => void;
  onFullscreen: () => void;
}

export function PlaybackControls({
  isPlaying,
  isMuted,
  volume,
  onPlayPause,
  onVolumeToggle,
  onVolumeChange,
  onFullscreen,
}: PlaybackControlsProps) {
  const btnClass =
    'w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors';

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <button onClick={onPlayPause} className={btnClass}>
        {isPlaying ? (
          <Pause className="w-5 h-5 text-white" />
        ) : (
          <Play className="w-5 h-5 text-white ml-0.5" />
        )}
      </button>

      <div className="flex items-center gap-2">
        <button onClick={onVolumeToggle} className={btnClass}>
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={isMuted ? 0 : volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#00e5a0]"
        />
      </div>

      <div className="flex-1" />

      <button onClick={onFullscreen} className={btnClass}>
        <Maximize className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}
