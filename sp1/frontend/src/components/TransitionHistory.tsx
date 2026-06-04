import { useSimulatorStore, STATE_COLORS, EVENT_LABELS, EVENT_COLORS, type SIPState, type SIPEvent } from '@/utils/sip'

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function TransitionHistory() {
  const stateHistory = useSimulatorStore((s) => s.stateHistory)
  const currentState = useSimulatorStore((s) => s.currentState)

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-300 font-['Outfit'] tracking-wide uppercase mb-3">
        Transition History
      </h3>

      <div className="flex-1 overflow-y-auto min-h-0 pr-1" style={{ maxHeight: '200px' }}>
        {stateHistory.length === 0 && (
          <div className="text-xs text-slate-600 font-['JetBrains_Mono'] italic py-4 text-center">
            No transitions yet.
          </div>
        )}

        <div className="relative">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-slate-700/50" />

          {stateHistory.map((entry, i) => (
            <div key={i} className="relative flex items-start gap-3 pb-4">
              <div
                className="w-[19px] h-[19px] rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2"
                style={{
                  backgroundColor: `${STATE_COLORS[entry.to as SIPState]}20`,
                  borderColor: STATE_COLORS[entry.to as SIPState],
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: STATE_COLORS[entry.to as SIPState],
                  }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-xs font-semibold font-['Outfit']"
                    style={{
                      color: STATE_COLORS[entry.from as SIPState],
                    }}
                  >
                    {entry.from}
                  </span>
                  <span className="text-slate-600 text-xs">→</span>
                  <span
                    className="text-xs font-semibold font-['Outfit']"
                    style={{
                      color: STATE_COLORS[entry.to as SIPState],
                    }}
                  >
                    {entry.to}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-['JetBrains_Mono']"
                    style={{
                      backgroundColor: `${EVENT_COLORS[entry.event as SIPEvent]}15`,
                      color: EVENT_COLORS[entry.event as SIPEvent],
                    }}
                  >
                    {EVENT_LABELS[entry.event as SIPEvent]}
                  </span>
                  <span className="text-[10px] text-slate-600 font-['JetBrains_Mono']">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div className="relative flex items-start gap-3">
            <div
              className="w-[19px] h-[19px] rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 animate-pulse"
              style={{
                backgroundColor: `${STATE_COLORS[currentState]}30`,
                borderColor: STATE_COLORS[currentState],
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: STATE_COLORS[currentState] }}
              />
            </div>
            <div className="flex items-center">
              <span
                className="text-xs font-bold font-['Outfit']"
                style={{ color: STATE_COLORS[currentState] }}
              >
                {currentState}
              </span>
              <span className="text-[10px] text-slate-500 ml-2 font-['JetBrains_Mono']">
                current
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
