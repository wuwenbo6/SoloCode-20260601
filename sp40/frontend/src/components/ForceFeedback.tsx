import { useState, useEffect, useCallback, useRef } from 'react'
import { Hand, Vibrate, Settings } from 'lucide-react'
import { useRobotStore } from '@/store/robotStore'

function TorqueBar({ desired, actual, index }: { desired: number; actual: number; index: number }) {
  const maxTorque = 10
  const desiredPct = (desired / maxTorque) * 100
  const actualPct = (actual / maxTorque) * 100
  const error = Math.abs(desired - actual)
  const errorColor = error > 2 ? '#ff3366' : error > 1 ? '#ffaa00' : '#00ff88'

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-mono text-[#888]">J{index + 1}</span>
        <span className="text-[10px] font-mono" style={{ color: errorColor }}>
          Δ: {error.toFixed(2)}
        </span>
      </div>
      <div className="relative h-6 bg-[#0a0e17] rounded border border-[#2a3040] overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-[#00ff88]/40 transition-all duration-100"
          style={{ width: `${desiredPct}%` }}
        />
        <div
          className="absolute left-0 top-0 h-full transition-all duration-100"
          style={{
            width: `${actualPct}%`,
            background: `linear-gradient(to right, #ffaa00, ${errorColor})`,
            opacity: 0.8,
          }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-[#00ff88] z-10"
          style={{ left: `${desiredPct}%`, boxShadow: '0 0 4px #00ff88' }}
        />
        <div className="absolute inset-x-0 top-0 h-full flex items-center justify-between px-1">
          <span className="text-[8px] font-mono text-[#00ff88]">D:{desired.toFixed(1)}</span>
          <span className="text-[8px] font-mono text-[#ffaa00]">A:{actual.toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}

export function ForceFeedback() {
  const desiredTorques = useRobotStore((s) => s.desiredTorques)
  const actualTorques = useRobotStore((s) => s.actualTorques)
  const [intensity, setIntensity] = useState(0.5)
  const [autoFeedback, setAutoFeedback] = useState(true)
  const [gamepad, setGamepad] = useState<Gamepad | null>(null)
  const lastFeedbackTimeRef = useRef(0)
  const smoothedErrorRef = useRef(0)

  useEffect(() => {
    const handleConnect = (e: GamepadEvent) => {
      setGamepad(e.gamepad)
    }
    const handleDisconnect = (e: GamepadEvent) => {
      if (gamepad?.index === e.gamepad.index) {
        setGamepad(null)
      }
    }
    window.addEventListener('gamepadconnected', handleConnect)
    window.addEventListener('gamepaddisconnected', handleDisconnect)
    return () => {
      window.removeEventListener('gamepadconnected', handleConnect)
      window.removeEventListener('gamepaddisconnected', handleDisconnect)
    }
  }, [gamepad])

  const triggerHaptic = useCallback(
    (intensityFactor: number) => {
      const now = Date.now()
      const cooldown = 500
      if (now - lastFeedbackTimeRef.current < cooldown) {
        return
      }
      lastFeedbackTimeRef.current = now

      const duration = Math.floor(100 * intensity * intensityFactor)
      const strongMagnitude = intensity * intensityFactor * 0.5
      const weakMagnitude = intensity * intensityFactor * 0.25

      const pads = navigator.getGamepads()
      for (const pad of pads) {
        if (pad?.vibrationActuator) {
          pad.vibrationActuator.playEffect('dual-rumble', {
            duration,
            strongMagnitude,
            weakMagnitude,
          })
        }
      }

      if ('vibrate' in navigator) {
        navigator.vibrate(duration)
      }
    },
    [intensity]
  )

  useEffect(() => {
    if (!autoFeedback) {
      smoothedErrorRef.current = 0
      return
    }

    const totalError = actualTorques.reduce((sum, t, i) => sum + Math.abs(desiredTorques[i] - t), 0)

    const alpha = 0.2
    smoothedErrorRef.current = smoothedErrorRef.current * (1 - alpha) + totalError * alpha

    if (smoothedErrorRef.current > 3) {
      triggerHaptic(Math.min(1, smoothedErrorRef.current / 15))
    }
  }, [actualTorques, desiredTorques, autoFeedback, triggerHaptic])

  return (
    <div className="bg-[#1a1f2e] rounded-lg p-4 border border-[#2a3040]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-[#00ff88] font-display tracking-wider flex items-center gap-2">
          <Hand size={14} />
          FORCE FEEDBACK
        </h3>
        <div className="flex items-center gap-2">
          {gamepad && (
            <span className="text-[9px] font-mono text-[#00ff88] bg-[#00ff88]/10 px-1.5 py-0.5 rounded border border-[#00ff88]/30">
              GAMEPAD
            </span>
          )}
          <span className="text-[9px] font-mono text-[#888] bg-[#0a0e17] px-1.5 py-0.5 rounded border border-[#2a3040]">
            {intensity < 0.3 ? 'LOW' : intensity < 0.7 ? 'MED' : 'HIGH'}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[10px] text-[#888] mb-2 font-mono uppercase tracking-wider">
          Torque Comparison
        </div>
        <div className="text-[10px] font-mono mb-2 flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 bg-[#00ff88]/40 rounded"></span>
            <span className="text-[#00ff88]">DESIRED</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 bg-[#ffaa00] rounded"></span>
            <span className="text-[#ffaa00]">ACTUAL</span>
          </span>
        </div>
        {desiredTorques.map((d, i) => (
          <TorqueBar key={i} desired={d} actual={actualTorques[i] || 0} index={i} />
        ))}
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-[10px] text-[#888] font-mono uppercase tracking-wider flex items-center gap-1">
            <Settings size={10} />
            Feedback Intensity
          </div>
          <span className="text-[10px] font-mono text-[#00ff88]">{(intensity * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={intensity}
          onChange={(e) => setIntensity(parseFloat(e.target.value))}
          className="w-full h-2 bg-[#0a0e17] rounded-full appearance-none cursor-pointer accent-[#00ff88]"
        />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoFeedback}
            onChange={(e) => setAutoFeedback(e.target.checked)}
            className="w-4 h-4 accent-[#00ff88]"
          />
          <span className="text-xs font-mono text-[#888]">Auto-feedback on error</span>
        </label>
      </div>

      <button
        onClick={() => triggerHaptic(1)}
        className="w-full py-2 bg-[#ffaa00]/20 text-[#ffaa00] border border-[#ffaa00]/50 rounded text-xs font-mono hover:bg-[#ffaa00]/30 transition-all flex items-center justify-center gap-2"
      >
        <Vibrate size={12} />
        TEST HAPTIC
      </button>
    </div>
  )
}
