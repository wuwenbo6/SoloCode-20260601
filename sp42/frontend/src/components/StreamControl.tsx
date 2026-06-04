import { motion } from 'framer-motion';
import { Play, Square, Radio } from 'lucide-react';
import { useFPVStore } from '@/stores/fpvStore';

interface StreamControlProps {
  onStart: () => void;
  onStop: () => void;
}

export default function StreamControl({ onStart, onStop }: StreamControlProps) {
  const streamStatus = useFPVStore((s) => s.streamStatus);

  const uptimeSec = Math.floor(streamStatus.uptime / 1000);
  const uptimeMin = Math.floor(uptimeSec / 60);
  const uptimeStr = `${uptimeMin.toString().padStart(2, '0')}:${(uptimeSec % 60).toString().padStart(2, '0')}`;

  return (
    <div className="hud-panel p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Radio size={16} className="text-hud-primary" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider hud-text">
          Stream Control
        </h3>
      </div>

      <div className="flex items-center gap-2">
        <motion.div
          className="w-2.5 h-2.5 rounded-full"
          animate={{
            backgroundColor: streamStatus.running ? '#00ff88' : '#ff3b30',
            boxShadow: streamStatus.running
              ? '0 0 8px rgba(0,255,136,0.6)'
              : '0 0 8px rgba(255,59,48,0.4)',
          }}
        />
        <span className="text-xs font-mono uppercase tracking-wider" style={{
          color: streamStatus.running ? '#00ff88' : '#ff3b30',
          textShadow: streamStatus.running
            ? '0 0 6px rgba(0,255,136,0.4)'
            : '0 0 6px rgba(255,59,48,0.3)',
        }}>
          {streamStatus.running ? 'RUNNING' : 'STOPPED'}
        </span>
      </div>

      <div className="flex gap-2">
        {!streamStatus.running ? (
          <button onClick={onStart} className="hud-btn flex items-center gap-2 flex-1">
            <Play size={14} />
            <span>Start</span>
          </button>
        ) : (
          <button onClick={onStop} className="hud-btn-danger hud-btn flex-1 flex items-center gap-2">
            <Square size={14} />
            <span>Stop</span>
          </button>
        )}
      </div>

      {streamStatus.running && (
        <motion.div
          className="space-y-2 text-xs font-mono"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <div className="flex justify-between">
            <span className="opacity-50">Resolution</span>
            <span className="hud-text">{streamStatus.resolution || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-50">FPS</span>
            <span className="hud-text">{streamStatus.fps || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-50">Uptime</span>
            <span className="hud-text">{uptimeStr}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
