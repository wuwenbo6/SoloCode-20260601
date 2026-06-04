import { useSimulatorStore, STATE_COLORS, type SIPState } from '@/utils/sip'

const STATES: SIPState[] = ['Idle', 'Calling', 'Proceeding', 'Completed', 'Terminated']

const STATE_DESCRIPTIONS: Record<SIPState, string> = {
  Idle: 'No active transaction',
  Calling: 'INVITE sent, awaiting response',
  Proceeding: 'Provisional response received',
  Completed: 'Final error response received (obsolete)',
  Terminated: 'Transaction finished',
}

const TRANSITIONS: { from: SIPState; to: SIPState; label: string }[] = [
  { from: 'Idle', to: 'Calling', label: 'INVITE' },
  { from: 'Calling', to: 'Proceeding', label: '1xx' },
  { from: 'Calling', to: 'Terminated', label: '2xx' },
  { from: 'Calling', to: 'Terminated', label: '3xx-6xx +ACK' },
  { from: 'Calling', to: 'Terminated', label: 'Timer B +CANCEL' },
  { from: 'Calling', to: 'Calling', label: '401/407 +Auth' },
  { from: 'Proceeding', to: 'Proceeding', label: '1xx' },
  { from: 'Proceeding', to: 'Terminated', label: '2xx' },
  { from: 'Proceeding', to: 'Terminated', label: '3xx-6xx +ACK' },
  { from: 'Proceeding', to: 'Calling', label: '401/407 +Auth' },
]

function StateNode({
  state,
  active,
  x,
  y,
}: {
  state: SIPState
  active: boolean
  x: number
  y: number
}) {
  const color = STATE_COLORS[state]
  return (
    <g transform={`translate(${x}, ${y})`}>
      {active && (
        <>
          <circle r={38} fill="none" stroke={color} strokeWidth="2" opacity={0.3}>
            <animate attributeName="r" values="38;48;38" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle r={36} fill="none" stroke={color} strokeWidth="1.5" opacity={0.5}>
            <animate attributeName="r" values="36;42;36" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      <rect
        x={-56}
        y={-20}
        width={112}
        height={40}
        rx={20}
        fill={active ? color : '#1e293b'}
        stroke={color}
        strokeWidth={active ? 2.5 : 1}
        opacity={active ? 1 : 0.6}
        style={{
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: active ? `drop-shadow(0 0 12px ${color}66)` : 'none',
        }}
      />
      <text
        textAnchor="middle"
        y={1}
        fill={active ? '#ffffff' : '#94a3b8'}
        fontSize={13}
        fontWeight={active ? 700 : 500}
        fontFamily="Outfit, sans-serif"
        style={{ transition: 'all 0.5s ease' }}
      >
        {state}
      </text>
    </g>
  )
}

export default function StateDiagram() {
  const currentState = useSimulatorStore((s) => s.currentState)
  const stateHistory = useSimulatorStore((s) => s.stateHistory)

  const positions: Record<SIPState, { x: number; y: number }> = {
    Idle: { x: 80, y: 100 },
    Calling: { x: 240, y: 100 },
    Proceeding: { x: 420, y: 100 },
    Completed: { x: 420, y: 220 },
    Terminated: { x: 580, y: 160 },
  }

  const lastTransition = stateHistory.length > 0 ? stateHistory[stateHistory.length - 1] : null
  const activeFrom = lastTransition?.from
  const activeTo = lastTransition?.to

  return (
    <div className="relative">
      <svg
        viewBox="0 0 660 280"
        className="w-full h-auto"
        style={{ maxHeight: '280px' }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#475569" />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
          </marker>
        </defs>

        {TRANSITIONS.map((tr, i) => {
          const fromPos = positions[tr.from]
          const toPos = positions[tr.to]
          if (!fromPos || !toPos) return null

          const isActive =
            activeFrom === tr.from &&
            activeTo === tr.to

          const isSelfLoop = tr.from === tr.to
          if (isSelfLoop) return null

          const dx = toPos.x - fromPos.x
          const dy = toPos.y - fromPos.y
          const len = Math.sqrt(dx * dx + dy * dy)
          const nx = dx / len
          const ny = dy / len

          const startX = fromPos.x + nx * 58
          const startY = fromPos.y + ny * 22
          const endX = toPos.x - nx * 58
          const endY = toPos.y - ny * 22

          const midX = (startX + endX) / 2
          const midY = (startY + endY) / 2

          const perpX = -ny * 14
          const perpY = nx * 14

          return (
            <g key={i}>
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={isActive ? '#f59e0b' : '#334155'}
                strokeWidth={isActive ? 2 : 1}
                markerEnd={`url(#${isActive ? 'arrowhead-active' : 'arrowhead'})`}
                style={{
                  transition: 'all 0.5s ease',
                  filter: isActive ? 'drop-shadow(0 0 4px #f59e0b66)' : 'none',
                }}
              />
              <text
                x={midX + perpX}
                y={midY + perpY - 4}
                textAnchor="middle"
                fill={isActive ? '#f59e0b' : '#64748b'}
                fontSize={9}
                fontFamily="JetBrains Mono, monospace"
                style={{ transition: 'all 0.5s ease' }}
              >
                {tr.label}
              </text>
            </g>
          )
        })}

        {STATES.map((state) => (
          <StateNode
            key={state}
            state={state}
            active={currentState === state}
            x={positions[state].x}
            y={positions[state].y}
          />
        ))}
      </svg>

      <div className="mt-3 flex items-center gap-2 px-2">
        <div
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: STATE_COLORS[currentState] }}
        />
        <span className="text-sm text-slate-300 font-medium font-['Outfit']">
          {currentState}
        </span>
        <span className="text-xs text-slate-500 font-['Outfit']">
          — {STATE_DESCRIPTIONS[currentState]}
        </span>
      </div>
    </div>
  )
}
