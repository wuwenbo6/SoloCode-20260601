import { useGameStore } from '@/stores/gameStore'

export default function ConnectionStatus() {
  const connectionState = useGameStore((s) => s.connectionState)
  const rtt = useGameStore((s) => s.streamStats.rtt)

  const state = connectionState.webrtc
  const color = state === 'connected' ? '#00ff88' : state === 'connecting' ? '#ffaa00' : '#ff3366'
  const label = state === 'connected' ? '已连接' : state === 'connecting' ? '连接中' : '未连接'

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-sm">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full animate-pulse-glow"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="font-heading text-xs text-gray-300">{label}</span>
      {state === 'connected' && (
        <span className="font-heading text-xs text-[var(--cyan)]">{rtt}ms</span>
      )}
    </div>
  )
}
