import { useEffect, useRef } from 'react'
import { ArrowUpRight, ArrowDownRight, Cpu } from 'lucide-react'
import { useSimulatorStore, type LogEntry } from '@/utils/sip'

function DirectionIcon({ direction }: { direction: LogEntry['direction'] }) {
  if (direction === 'send')
    return <ArrowUpRight size={12} className="text-blue-400" />
  if (direction === 'recv')
    return <ArrowDownRight size={12} className="text-emerald-400" />
  return <Cpu size={12} className="text-amber-400" />
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + `.${String(d.getMilliseconds()).padStart(3, '0')}`
}

export default function MessageLog() {
  const logs = useSimulatorStore((s) => s.logs)
  const selectedLogId = useSimulatorStore((s) => s.selectedLogId)
  const setSelectedLogId = useSimulatorStore((s) => s.setSelectedLogId)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const selectedLog = logs.find((l) => l.id === selectedLogId)

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-300 font-['Outfit'] tracking-wide uppercase mb-3">
        Message Log
      </h3>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1"
        style={{ maxHeight: '240px' }}
      >
        {logs.length === 0 && (
          <div className="text-xs text-slate-600 font-['JetBrains_Mono'] italic py-4 text-center">
            No messages yet. Trigger an event to begin.
          </div>
        )}
        {logs.map((log) => (
          <button
            key={log.id}
            onClick={() =>
              setSelectedLogId(selectedLogId === log.id ? null : log.id)
            }
            className={`
              w-full text-left px-2.5 py-1.5 rounded-md transition-all duration-150
              font-['JetBrains_Mono'] text-xs
              ${
                selectedLogId === log.id
                  ? 'bg-slate-700/60 border border-slate-600/50'
                  : 'hover:bg-slate-800/40 border border-transparent'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <DirectionIcon direction={log.direction} />
              <span className="text-slate-500">{formatTime(log.timestamp)}</span>
              <span
                className={
                  log.direction === 'send'
                    ? 'text-blue-400'
                    : log.direction === 'recv'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                }
              >
                {log.messageType}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedLog && (
        <div className="mt-3 bg-slate-900/80 rounded-lg border border-slate-700/50 p-3 overflow-x-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-['Outfit']">
              SIP Message Detail
            </span>
            <button
              onClick={() => setSelectedLogId(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          </div>
          <pre className="text-xs text-slate-300 font-['JetBrains_Mono'] whitespace-pre-wrap leading-relaxed">
            {selectedLog.content}
          </pre>
        </div>
      )}
    </div>
  )
}
