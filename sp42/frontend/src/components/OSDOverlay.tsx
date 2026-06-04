import { useFPVStore } from '@/stores/fpvStore';
import { motion } from 'framer-motion';

function SignalBars({ strength }: { strength: number }) {
  const bars = 5;
  const filled = Math.round((strength / 100) * bars);
  return (
    <div className="flex items-end gap-0.5">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 transition-all duration-300"
          style={{
            height: `${4 + i * 3}px`,
            backgroundColor: i < filled ? '#00ff88' : 'rgba(0,255,136,0.2)',
            boxShadow: i < filled ? '0 0 4px rgba(0,255,136,0.5)' : 'none',
          }}
        />
      ))}
    </div>
  );
}

function OSDValue({
  label,
  value,
  unit,
  color = '#00ff88',
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="text-xs font-heading font-bold uppercase tracking-wider opacity-70"
        style={{ color }}
      >
        {label}
      </span>
      <motion.span
        className="text-lg font-mono font-bold tabular-nums"
        style={{
          color,
          textShadow: `0 0 8px ${color}88, 0 0 16px ${color}44`,
        }}
        key={`${label}-${value}`}
        initial={{ opacity: 0.7 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        {typeof value === 'number' ? value.toFixed(1) : value}
      </motion.span>
      {unit && (
        <span className="text-xs font-mono opacity-50" style={{ color }}>
          {unit}
        </span>
      )}
    </div>
  );
}

export default function OSDOverlay({
  bufferInfo,
}: {
  bufferInfo?: { frames: number; telemetry: number };
}) {
  const telemetry = useFPVStore((s) => s.telemetry);
  const recording = useFPVStore((s) => s.recording);
  const recordingElapsedMs = useFPVStore((s) => s.recordingElapsedMs);
  const gimbal = useFPVStore((s) => s.gimbal);

  const elapsedSec = Math.floor(recordingElapsedMs / 1000);
  const recMin = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
  const recSec = (elapsedSec % 60).toString().padStart(2, '0');

  const batteryColor =
    telemetry.batteryVoltage > 14
      ? '#00ff88'
      : telemetry.batteryVoltage > 12
        ? '#ff9500'
        : '#ff3b30';

  return (
    <div className="absolute inset-0 pointer-events-none z-10 p-4 flex flex-col justify-between font-mono">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <OSDValue label="ALT" value={telemetry.altitude} unit="m" />
          <OSDValue label="SPD" value={telemetry.speed} unit="m/s" />
          {bufferInfo && (
            <div className="text-[10px] opacity-50 mt-2" style={{ color: '#00d4ff' }}>
              BUF: {bufferInfo.frames}F / {bufferInfo.telemetry}T
            </div>
          )}
        </div>
        <div className="space-y-1 text-right">
          <OSDValue label="GPS" value={`${telemetry.gpsLat.toFixed(4)}, ${telemetry.gpsLon.toFixed(4)}`} color="#00d4ff" />
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs opacity-50" style={{ color: '#00d4ff' }}>GIMBAL</span>
            <span className="text-sm" style={{ color: '#00d4ff', textShadow: '0 0 6px rgba(0,212,255,0.5)' }}>
              {gimbal.yaw.toFixed(0)}° / {gimbal.pitch.toFixed(0)}° / {gimbal.roll.toFixed(0)}°
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <OSDValue label="BAT" value={telemetry.batteryVoltage} unit="V" color={batteryColor} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-50" style={{ color: '#00ff88' }}>SIG</span>
            <SignalBars strength={telemetry.signalStrength} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {recording && (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="w-2.5 h-2.5 rounded-full bg-red-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ boxShadow: '0 0 8px rgba(255,59,48,0.7)' }}
              />
              <span
                className="text-sm font-mono font-bold"
                style={{
                  color: '#ff3b30',
                  textShadow: '0 0 6px rgba(255,59,48,0.5)',
                }}
              >
                REC {recMin}:{recSec}
              </span>
            </motion.div>
          )}
        </div>

        <div />
      </div>
    </div>
  );
}
