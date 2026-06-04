import { useCallback, useRef, useEffect, useState } from 'react'

interface VirtualJoystickProps {
  x: number
  y: number
  onMove: (dx: number, dy: number) => void
  onDrag: (newX: number, newY: number) => void
  size?: number
}

export default function VirtualJoystick({ x, y, onMove, onDrag, size = 120 }: VirtualJoystickProps) {
  const [active, setActive] = useState(false)
  const [knobPos, setKnobPos] = useState({ dx: 0, dy: 0 })
  const baseRef = useRef<HTMLDivElement>(null)
  const touchIdRef = useRef<number | null>(null)
  const dragModeRef = useRef(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const startPosRef = useRef({ x: 0, y: 0 })

  const maxDistance = size / 2 - 20

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    const touch = e.changedTouches[0]
    touchIdRef.current = touch.identifier
    startPosRef.current = { x: touch.clientX, y: touch.clientY }
    dragModeRef.current = false

    longPressTimerRef.current = setTimeout(() => {
      dragModeRef.current = true
    }, 500)

    setActive(true)
    setKnobPos({ dx: 0, dy: 0 })
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (touch.identifier !== touchIdRef.current) continue

      const dx = touch.clientX - startPosRef.current.x
      const dy = touch.clientY - startPosRef.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dragModeRef.current) {
        const parent = baseRef.current?.parentElement
        if (parent) {
          const rect = parent.getBoundingClientRect()
          onDrag(
            touch.clientX - rect.left - size / 2,
            touch.clientY - rect.top - size / 2
          )
        }
        return
      }

      if (dist > 15) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
        }
      }

      const clampedDist = Math.min(dist, maxDistance)
      const angle = Math.atan2(dy, dx)
      const clampedDx = Math.cos(angle) * clampedDist
      const clampedDy = Math.sin(angle) * clampedDist

      setKnobPos({ dx: clampedDx, dy: clampedDy })
      onMove(clampedDx / maxDistance, clampedDy / maxDistance)
    }
  }, [maxDistance, onMove, onDrag, size])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier !== touchIdRef.current) continue
      touchIdRef.current = null
      setActive(false)
      setKnobPos({ dx: 0, dy: 0 })
      onMove(0, 0)
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [onMove])

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={baseRef}
      className="absolute touch-overlay"
      style={{ left: x, top: y, width: size, height: size }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`absolute inset-0 rounded-full border-2 transition-colors duration-150 ${
          active
            ? 'border-[var(--cyan)]/60 bg-[var(--cyan)]/10'
            : 'border-white/20 bg-white/5'
        }`}
        style={{ boxShadow: active ? '0 0 20px rgba(0,240,255,0.2)' : 'none' }}
      />
      <div
        className="absolute rounded-full transition-all duration-75"
        style={{
          width: size * 0.45,
          height: size * 0.45,
          left: size / 2 - (size * 0.45) / 2 + knobPos.dx,
          top: size / 2 - (size * 0.45) / 2 + knobPos.dy,
          backgroundColor: active ? 'rgba(0,240,255,0.5)' : 'rgba(255,255,255,0.2)',
          boxShadow: active ? '0 0 12px rgba(0,240,255,0.4)' : 'none',
        }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: active ? 0 : 0.3 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
          <path d="M12 2v20M2 12h20M7 7l-5 5 5 5M17 7l5 5-5 5" />
        </svg>
      </div>
    </div>
  )
}
