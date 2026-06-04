import StateDiagram from '@/components/StateDiagram'
import EventPanel from '@/components/EventPanel'
import MessageLog from '@/components/MessageLog'
import TransitionHistory from '@/components/TransitionHistory'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useSimulatorStore } from '@/utils/sip'
import { AlertCircle } from 'lucide-react'

export default function Home() {
  const wsUrl = import.meta.env.DEV
    ? `ws://${window.location.host}/ws`
    : `ws://${window.location.hostname}:8080/ws`
  const { sendEvent, reset } = useWebSocket(wsUrl)
  const error = useSimulatorStore((s) => s.error)

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-200 font-['Outfit']">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                SIP Transaction Simulator
              </h1>
              <p className="text-xs text-slate-500 font-['JetBrains_Mono']">
                INVITE Client Transaction · RFC 3261
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in">
            <AlertCircle size={16} />
            <span className="font-['JetBrains_Mono'] text-xs">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-slate-900/50 rounded-xl border border-slate-800/80 p-5 backdrop-blur-sm">
              <h2 className="text-sm font-semibold text-slate-400 font-['Outfit'] tracking-wide uppercase mb-4">
                State Machine
              </h2>
              <StateDiagram />
            </section>

            <section className="bg-slate-900/50 rounded-xl border border-slate-800/80 p-5 backdrop-blur-sm">
              <MessageLog />
            </section>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <section className="bg-slate-900/50 rounded-xl border border-slate-800/80 p-5 backdrop-blur-sm">
              <EventPanel onEvent={sendEvent} onReset={reset} />
            </section>

            <section className="bg-slate-900/50 rounded-xl border border-slate-800/80 p-5 backdrop-blur-sm">
              <TransitionHistory />
            </section>
          </div>
        </div>

        <footer className="mt-8 text-center">
          <p className="text-xs text-slate-700 font-['JetBrains_Mono']">
            SIP INVITE Client Transaction State Machine · Based on RFC 3261 §17.1.1
          </p>
        </footer>
      </div>
    </div>
  )
}
