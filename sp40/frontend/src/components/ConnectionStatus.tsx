import { useEffect } from 'react'
import { Wifi, WifiOff, Clock, Activity, Upload } from 'lucide-react'
import { useRobotStore } from '@/store/robotStore'

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const parts = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m % 60}m`)
  parts.push(`${s % 60}s`)
  return parts.join(' ')
}

export function ConnectionStatus() {
  const status = useRobotStore((s) => s.connection.status)
  const latency = useRobotStore((s) => s.connection.latency)
  const throughput = useRobotStore((s) => s.connection.throughput)
  const connectionTime = useRobotStore((s) => s.connectionTime)
  const updateConnectionTime = useRobotStore((s) => s.updateConnectionTime)

  useEffect(() => {
    if (status === 'connected') {
      const interval = setInterval(updateConnectionTime, 1000)
      return () => clearInterval(interval)
    }
  }, [status, updateConnectionTime])

  const statusConfig = {
    connected: { color: '#00ff88', label: 'CONNECTED', Icon: Wifi },
    connecting: { color: '#ffaa00', label: 'CONNECTING...', Icon: Activity },
    disconnected: { color: '#888', label: 'DISCONNECTED', Icon: WifiOff },
    error: { color: '#ff3366', label: 'ERROR', Icon: WifiOff },
  }[status]

  const { color, label, Icon } = statusConfig

  return (
    <div className="bg-[#1a1f2e] border-t border-[#2a3040] px-4 py-2 flex items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {status === 'connected' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }}></span>
          )}
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }}></span>
        </span>
        <Icon size={14} style={{ color }} />
        <span className="text-xs font-mono" style={{ color }}>
          {label}
        </span>
      </div>

      <div className="flex items-center gap-6 ml-auto text-xs font-mono">
        <div className="flex items-center gap-1.5 text-[#888]">
          <Clock size={12} />
          <span>LATENCY</span>
          <span style={{ color: latency < 50 ? '#00ff88' : latency < 100 ? '#ffaa00' : '#ff3366' }}>
            {latency}ms
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#888]">
          <Activity size={12} />
          <span>THROUGHPUT</span>
          <span className="text-[#00ff88]">{throughput.toLocaleString()} B/s</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#888]">
          <Upload size={12} />
          <span>UPTIME</span>
          <span className="text-[#00ff88]">{formatDuration(connectionTime)}</span>
        </div>
      </div>
    </div>
  )
}
