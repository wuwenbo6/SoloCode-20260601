import { useCallback, useRef, useState } from 'react'

interface VirtualButtonProps {
  x: number
  y: number
  label: string
  buttonId: string
  color?: string
  size?: number
  onPress: (buttonId: string, pressed: boolean) => void
  onDrag: (newX: number, newY: number) => void
}

export default function VirtualButton({
  x,
  y,
  label,
  buttonId,
  color = 'var(--cyan)',
  size = 64,
  onPress,
  onDrag,
}: VirtualButtonProps) {
  const [pressed, setPressed] = useState(false)
  const touchIdRef = useRef<number | null>(null)
  const dragModeRef = useRef(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const startPosRef = useRef({ x: 0, y: 0 })

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    const touch = e.changedTouches[0]
    touchIdRef.current = touch.identifier
    startPosRef.current = { x: touch.clientX, y: touch.clientY }
    dragModeRef.current = false

    longPressTimerRef.current = setTimeout(() => {
      dragModeRef.current = true
    }, 500)

    setPressed(true)
    onPress(buttonId, true)
  }, [buttonId, onPress])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (touch.identifier !== touchIdRef.current) continue

      if (dragModeRef.current) {
        const parent = (e.target as HTMLElement).closest('.touch-overlay-container')
        if (parent) {
          const rect = parent.getBoundingClientRect()
          onDrag(
            touch.clientX - rect.left - size / 2,
            touch.clientY - rect.top - size / 2
          )
        }
        return
      }

      const dx = touch.clientX - startPosRef.current.x
      const dy = touch.clientY - startPosRef.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 15 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [buttonId, onDrag, size])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier !== touchIdRef.current) continue
      touchIdRef.current = null
      setPressed(false)
      onPress(buttonId, false)
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [buttonId, onPress])

  return (
    <div
      className="absolute touch-overlay"
      style={{ left: x, top: y, width: size, height: size }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`absolute inset-0 rounded-full border-2 transition-all duration-100 flex items-center justify-center ${
          pressed ? 'scale-90' : ''
        }`}
        style={{
          borderColor: pressed ? color : `${color}60`,
          backgroundColor: pressed ? `${color}40` : `${color}10`,
          boxShadow: pressed
            ? `0 0 20px ${color}40, inset 0 0 10px ${color}20`
            : `0 0 10px ${color}10`,
        }}
      >
        <span
          className="font-heading font-bold pointer-events-none"
          style={{
            color: pressed ? color : `${color}90`,
            fontSize: size * 0.3,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
