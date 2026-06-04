import { useState, useCallback } from 'react'
import { Power, PowerOff, AlertTriangle } from 'lucide-react'
import { useRobotStore } from '@/store/robotStore'
import { useWebSocket } from '@/hooks/useWebSocket'

const JOINT_NAMES = ['Base', 'Shoulder', 'Elbow', 'Wrist 1', 'Wrist 2', 'Wrist 3']

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  unit,
  color = '#00ff88',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  unit: string
  color?: string
}) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <label className="text-[10px] font-mono text-[#888] uppercase tracking-wider">{label}</label>
        <input
          type="number"
          value={value.toFixed(2)}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-16 bg-[#0a0e17] border border-[#2a3040] rounded px-1.5 py-0.5 text-[10px] font-mono text-white text-right focus:outline-none focus:border-[#00ff88]"
          step="0.1"
        />
      </div>
      <div className="relative h-2">
        <div className="absolute inset-0 bg-[#0a0e17] rounded-full border border-[#2a3040]" />
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-100"
          style={{ width: `${percentage}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-[#555] mt-0.5">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

export function ControlPanel() {
  const { connect, disconnect } = useWebSocket()
  const status = useRobotStore((s) => s.connection.status)
  const sendControl = useRobotStore((s) => s.sendControl)

  const [wheelLeft, setWheelLeft] = useState(0)
  const [wheelRight, setWheelRight] = useState(0)
  const [joints, setJoints] = useState<number[]>([0, 0, 0, 0, 0, 0])
  const [torques, setTorques] = useState<number[]>([5, 5, 5, 5, 5, 5])

  const send = useCallback(() => {
    sendControl({
      wheels: { leftSpeed: wheelLeft, rightSpeed: wheelRight },
      arm: { joints: [...joints] },
      force: { desiredTorques: [...torques] },
    })
  }, [wheelLeft, wheelRight, joints, torques, sendControl])

  const emergencyStop = useCallback(() => {
    setWheelLeft(0)
    setWheelRight(0)
    setJoints([0, 0, 0, 0, 0, 0])
    sendControl({
      wheels: { leftSpeed: 0, rightSpeed: 0 },
      arm: { joints: [0, 0, 0, 0, 0, 0] },
      force: { desiredTorques: [0, 0, 0, 0, 0, 0] },
    })
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 50, 200, 50, 200])
    }
  }, [sendControl])

  const handleJointChange = (index: number, value: number) => {
    setJoints((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleTorqueChange = (index: number, value: number) => {
    setTorques((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const isConnected = status === 'connected'

  return (
    <div className="bg-[#1a1f2e] rounded-lg p-4 border border-[#2a3040]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-[#00ff88] font-display tracking-wider">CONTROL</h3>
        <button
          onClick={isConnected ? disconnect : connect}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all ${
            isConnected
              ? 'bg-[#ff3366]/20 text-[#ff3366] border border-[#ff3366]/50 hover:bg-[#ff3366]/30'
              : 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50 hover:bg-[#00ff88]/30'
          }`}
        >
          {isConnected ? <PowerOff size={12} /> : <Power size={12} />}
          {isConnected ? 'DISCONNECT' : 'CONNECT'}
        </button>
      </div>

      <div className="mb-4">
        <div className="text-[10px] text-[#888] mb-2 font-mono uppercase tracking-wider">Wheel Speed</div>
        <Slider
          label="Left"
          value={wheelLeft}
          onChange={(v) => setWheelLeft(v)}
          min={-1}
          max={1}
          unit="×"
          color="#00ff88"
        />
        <Slider
          label="Right"
          value={wheelRight}
          onChange={(v) => setWheelRight(v)}
          min={-1}
          max={1}
          unit="×"
          color="#00ff88"
        />
      </div>

      <div className="mb-4">
        <div className="text-[10px] text-[#888] mb-2 font-mono uppercase tracking-wider">Joint Angles (°)</div>
        {JOINT_NAMES.map((name, i) => (
          <Slider
            key={name}
            label={`J${i + 1} ${name}`}
            value={(joints[i] * 180) / Math.PI}
            onChange={(v) => handleJointChange(i, (v * Math.PI) / 180)}
            min={-180}
            max={180}
            unit="°"
            color={i % 2 === 0 ? '#00ff88' : '#00aaff'}
          />
        ))}
      </div>

      <div className="mb-4">
        <div className="text-[10px] text-[#888] mb-2 font-mono uppercase tracking-wider">Desired Torque (N·m)</div>
        {JOINT_NAMES.slice(0, 6).map((name, i) => (
          <Slider
            key={`t-${name}`}
            label={`T${i + 1}`}
            value={torques[i]}
            onChange={(v) => handleTorqueChange(i, v)}
            min={0}
            max={10}
            unit=""
            color="#ffaa00"
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={send}
          disabled={!isConnected}
          className="py-2 bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/50 rounded text-xs font-mono hover:bg-[#00ff88]/30 transition-all neon-glow disabled:opacity-30 disabled:cursor-not-allowed"
        >
          SEND
        </button>
        <button
          onClick={emergencyStop}
          className="py-2 bg-[#ff3366]/20 text-[#ff3366] border border-[#ff3366]/50 rounded text-xs font-mono hover:bg-[#ff3366]/30 transition-all flex items-center justify-center gap-1.5 emergency-btn"
        >
          <AlertTriangle size={12} />
          E-STOP
        </button>
      </div>
    </div>
  )
}
