import { motion } from 'framer-motion';
import { Circle, Square } from 'lucide-react';

interface RecordButtonProps {
  recording: boolean;
  elapsedMs: number;
  onToggle: () => void;
}

export default function RecordButton({ recording, elapsedMs, onToggle }: RecordButtonProps) {
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const min = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
  const sec = (elapsedSec % 60).toString().padStart(2, '0');

  return (
    <div className="flex items-center gap-3 pointer-events-auto">
      {recording && (
        <motion.span
          className="text-sm font-mono font-bold"
          style={{
            color: '#ff3b30',
            textShadow: '0 0 6px rgba(255,59,48,0.5)',
          }}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {min}:{sec}
        </motion.span>
      )}
      <button
        onClick={onToggle}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
          recording
            ? 'bg-red-500/20 border-2 border-red-500 shadow-hud-glow-alert'
            : 'bg-white/5 border-2 border-hud-border hover:border-hud-primary hover:shadow-hud-glow'
        }`}
      >
        {recording ? (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            <Square size={16} className="text-red-400 fill-red-400" />
          </motion.div>
        ) : (
          <Circle size={20} className="text-hud-primary fill-red-400" />
        )}
      </button>
    </div>
  );
}
