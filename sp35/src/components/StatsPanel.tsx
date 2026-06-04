import { useGameStore } from '@/stores/gameStore'
import { Activity, Wifi, Gauge, Clock, Trophy, Shield, RefreshCw, Zap } from 'lucide-react'

export default function StatsPanel() {
  const stats = useGameStore((s) => s.streamStats)

  return (
    <div className="absolute top-3 left-3 z-20 flex flex-col gap-1 rounded-lg border border-[var(--cyan)]/30 bg-black/70 px-3 py-2 font-mono text-xs backdrop-blur-sm pointer-events-auto">
      <div className="flex items-center gap-2 text-[var(--cyan)]">
        <Gauge size={12} />
        <span>码率: {Math.round(stats.bitrate)} kbps</span>
      </div>
      <div className="flex items-center gap-2 text-[var(--cyan)]">
        <Activity size={12} />
        <span>FPS: {stats.fps}</span>
      </div>
      <div className="flex items-center gap-2 text-[var(--cyan)]">
        <Wifi size={12} />
        <span>丢包: {(stats.packetLoss * 100).toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-2 text-[var(--cyan)]">
        <Clock size={12} />
        <span>RTT: {stats.rtt} ms</span>
      </div>
      <div className="flex items-center gap-2 text-[var(--cyan)]">
        <Zap size={12} />
        <span>输入延迟: {stats.inputLatency} ms</span>
      </div>
      <div className="flex items-center gap-2 text-green-400">
        <Shield size={12} />
        <span>FEC恢复: {stats.fecRecovered}</span>
      </div>
      <div className="flex items-center gap-2 text-yellow-400">
        <RefreshCw size={12} />
        <span>NACK恢复: {stats.nackRecovered}</span>
      </div>
      <div className="flex items-center gap-2 text-yellow-400">
        <Trophy size={12} />
        <span>分数: {stats.gameScore}</span>
      </div>
    </div>
  )
}
