import { Activity, Volume2, VolumeX, Wifi, WifiOff, Key, Nfc, Monitor, UserPlus } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAccessStore } from '@/stores/accessStore'

export default function Events() {
  const { connected } = useWebSocket()
  const { events, soundEnabled, toggleSound } = useAccessStore()

  const methodIcon = (method: string) => {
    switch (method) {
      case 'webauthn': return <Key size={14} />
      case 'nfc': return <Nfc size={14} />
      case 'remote': return <Monitor size={14} />
      case 'visitor': return <UserPlus size={14} />
      default: return <Activity size={14} />
    }
  }

  const methodLabel = (method: string) => {
    switch (method) {
      case 'webauthn': return '密钥'
      case 'nfc': return 'NFC'
      case 'remote': return '远程'
      case 'visitor': return '访客'
      default: return method
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity size={22} className="text-accent" />
          实时事件
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {connected ? (
              <Wifi size={16} className="text-accent" />
            ) : (
              <WifiOff size={16} className="text-danger" />
            )}
            <span className={`text-xs ${connected ? 'text-accent' : 'text-danger'}`}>
              {connected ? '已连接' : '断开'}
            </span>
          </div>
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg transition-colors ${
              soundEnabled ? 'bg-accent/20 text-accent' : 'bg-secondary text-gray-400'
            }`}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border border-accent/20 animate-pulse-ring" />
            </div>
            <div className="w-24 h-24 rounded-full bg-accent/5 flex items-center justify-center">
              <Activity size={40} className="text-accent/40" />
            </div>
          </div>
          <p className="mt-6 text-gray-500">等待门禁事件...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => (
            <div
              key={`${event.timestamp}-${index}`}
              className={`p-4 rounded-xl border transition-all ${
                event.success
                  ? 'bg-surface border-accent/20 hover:border-accent/40'
                  : 'bg-surface border-danger/20 hover:border-danger/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    event.success ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'
                  }`}>
                    {methodIcon(event.method)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{event.username || event.operatorType}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        event.operatorType === 'admin' ? 'bg-purple-400/10 text-purple-400' : event.operatorType === 'visitor' ? 'bg-info/10 text-info' : 'bg-accent/10 text-accent'
                      }`}>
                        {event.operatorType === 'admin' ? '管理员' : event.operatorType === 'visitor' ? '访客' : '用户'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                      <span>{event.doorName}</span>
                      <span className="text-secondary">|</span>
                      <span>{methodLabel(event.method)}</span>
                      {event.gps && (
                        <>
                          <span className="text-secondary">|</span>
                          <span className="font-mono text-xs">
                            {event.gps.latitude.toFixed(4)}, {event.gps.longitude.toFixed(4)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${event.success ? 'text-accent' : 'text-danger'}`}>
                    {event.success ? '通过' : '拒绝'}
                  </span>
                  <div className="text-xs text-gray-500 font-mono mt-1">
                    {new Date(event.timestamp).toLocaleTimeString('zh-CN')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
