import { motion } from 'framer-motion';
import { useFPVStore } from '@/stores/fpvStore';

export default function GimbalIndicator() {
  const gimbal = useFPVStore((s) => s.gimbal);

  const yawOffset = (gimbal.yaw / 180) * 40;
  const pitchOffset = (-gimbal.pitch / 90) * 40;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(0,255,136,0.3)"
            strokeWidth="1"
          />
          <circle
            cx="50"
            cy="50"
            r="30"
            fill="none"
            stroke="rgba(0,255,136,0.15)"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
          <line
            x1="5"
            y1="50"
            x2="95"
            y2="50"
            stroke="rgba(0,255,136,0.2)"
            strokeWidth="0.5"
          />
          <line
            x1="50"
            y1="5"
            x2="50"
            y2="95"
            stroke="rgba(0,255,136,0.2)"
            strokeWidth="0.5"
          />
          <motion.line
            x1={50 + yawOffset - 8}
            y1={50 + pitchOffset}
            x2={50 + yawOffset + 8}
            y2={50 + pitchOffset}
            stroke="#00ff88"
            strokeWidth="2"
            animate={{
              x1: 50 + yawOffset - 8,
              y1: 50 + pitchOffset,
              x2: 50 + yawOffset + 8,
              y2: 50 + pitchOffset,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
          <motion.line
            x1={50 + yawOffset}
            y1={50 + pitchOffset - 8}
            x2={50 + yawOffset}
            y2={50 + pitchOffset + 8}
            stroke="#00ff88"
            strokeWidth="2"
            animate={{
              x1: 50 + yawOffset,
              y1: 50 + pitchOffset - 8,
              x2: 50 + yawOffset,
              y2: 50 + pitchOffset + 8,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
          <motion.circle
            cx={50 + yawOffset}
            cy={50 + pitchOffset}
            r="3"
            fill="#00ff88"
            style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,136,0.6))' }}
            animate={{
              cx: 50 + yawOffset,
              cy: 50 + pitchOffset,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </svg>
      </div>
      <div className="flex gap-3 text-xs font-mono">
        <span className="hud-text-info">Y {gimbal.yaw.toFixed(1)}°</span>
        <span className="hud-text-info">P {gimbal.pitch.toFixed(1)}°</span>
        <span className="hud-text-info">R {gimbal.roll.toFixed(1)}°</span>
      </div>
    </div>
  );
}
