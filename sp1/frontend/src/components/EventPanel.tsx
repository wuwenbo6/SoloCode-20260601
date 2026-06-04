import {
  PhoneOutgoing,
  PhoneIncoming,
  PhoneCall,
  PhoneOff,
  Timer,
  PhoneForwarded,
  CheckCircle2,
  Ban,
  ShieldAlert,
  ShieldQuestion,
  Download,
} from 'lucide-react'
import { useSimulatorStore, EVENT_LABELS, EVENT_COLORS, type SIPEvent } from '@/utils/sip'

const EVENT_ICONS: Record<SIPEvent, React.ReactNode> = {
  send_invite: <PhoneOutgoing size={15} />,
  recv_1xx: <PhoneIncoming size={15} />,
  recv_2xx: <PhoneCall size={15} />,
  recv_3xx_6xx: <PhoneOff size={15} />,
  recv_401: <ShieldAlert size={15} />,
  recv_407: <ShieldQuestion size={15} />,
  timer_b: <Timer size={15} />,
  timer_d: <Timer size={15} />,
  ack_sent: <CheckCircle2 size={15} />,
  cancel_sent: <Ban size={15} />,
  invite_auth: <PhoneOutgoing size={15} />,
  invite_prx_auth: <PhoneOutgoing size={15} />,
}

const EVENT_GROUPS = [
  {
    label: 'Send',
    events: ['send_invite'] as SIPEvent[],
  },
  {
    label: 'Receive',
    events: ['recv_1xx', 'recv_2xx', 'recv_3xx_6xx', 'recv_401', 'recv_407'] as SIPEvent[],
  },
  {
    label: 'Timers',
    events: ['timer_b', 'timer_d'] as SIPEvent[],
  },
]

export default function EventPanel({
  onEvent,
  onReset,
}: {
  onEvent: (event: string) => void
  onReset: () => void
}) {
  const currentState = useSimulatorStore((s) => s.currentState)
  const validEvents = useSimulatorStore((s) => s.validEvents)
  const connected = useSimulatorStore((s) => s.connected)

  const handleExport = () => {
    const backendUrl = import.meta.env.DEV
      ? `http://${window.location.host}/api/logs`
      : `http://${window.location.hostname}:8080/api/logs`
    window.open(backendUrl, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 font-['Outfit'] tracking-wide uppercase">
          Event Controls
        </h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}
          />
          <span className="text-xs text-slate-500 font-['JetBrains_Mono']">
            {connected ? 'WS' : 'OFF'}
          </span>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
        <span className="text-xs text-slate-500 font-['JetBrains_Mono']">State: </span>
        <span className="text-sm font-bold text-slate-200 font-['Outfit']">
          {currentState}
        </span>
      </div>

      <div className="bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
        <p className="text-[11px] text-amber-400/90 font-['JetBrains_Mono'] leading-relaxed">
          <span className="font-bold">Auto:</span> 3xx→ACK; Timer B→CANCEL; 401/407→INVITE+Auth
        </p>
      </div>

      {EVENT_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-xs text-slate-500 mb-2 font-['Outfit'] tracking-wider uppercase">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.events.map((event) => {
              const isValid = validEvents.includes(event)
              const color = EVENT_COLORS[event]
              return (
                <button
                  key={event}
                  onClick={() => onEvent(event)}
                  disabled={!isValid || !connected}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium
                    font-['JetBrains_Mono'] transition-all duration-200 border
                    ${
                      isValid && connected
                        ? 'cursor-pointer hover:scale-105 active:scale-95'
                        : 'cursor-not-allowed opacity-30'
                    }
                  `}
                  style={{
                    backgroundColor: isValid && connected ? `${color}15` : 'transparent',
                    borderColor: isValid && connected ? `${color}50` : '#334155',
                    color: isValid && connected ? color : '#475569',
                    boxShadow:
                      isValid && connected
                        ? `0 0 12px ${color}20, inset 0 1px 0 ${color}10`
                        : 'none',
                  }}
                >
                  {EVENT_ICONS[event]}
                  {EVENT_LABELS[event]}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            text-sm font-medium font-['Outfit'] transition-all duration-200
            bg-slate-800/60 text-slate-400 border border-slate-700/50
            hover:bg-slate-700/60 hover:text-slate-300 hover:border-slate-600
            active:scale-[0.98]"
        >
          <PhoneForwarded size={14} />
          Reset
        </button>

        <button
          onClick={handleExport}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            text-sm font-medium font-['Outfit'] transition-all duration-200
            bg-cyan-500/10 text-cyan-400 border border-cyan-500/30
            hover:bg-cyan-500/20 hover:text-cyan-300
            active:scale-[0.98]"
        >
          <Download size={14} />
          Export Log
        </button>
      </div>
    </div>
  )
}
