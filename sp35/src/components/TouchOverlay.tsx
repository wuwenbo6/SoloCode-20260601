import { useCallback, useEffect } from 'react'
import { useGameStore } from '@/stores/gameStore'
import VirtualJoystick from './VirtualJoystick'
import VirtualButton from './VirtualButton'
import type { ClientMessage } from '../../shared/types'
import { createJoystickMessage, createButtonMessage } from '@/utils/protocol'

interface TouchOverlayProps {
  onInput: (msg: ClientMessage) => void
}

export default function TouchOverlay({ onInput }: TouchOverlayProps) {
  const touchLayout = useGameStore((s) => s.touchLayout)
  const updateTouchLayout = useGameStore((s) => s.updateTouchLayout)
  const showTouchControls = useGameStore((s) => s.showTouchControls)
  const setPassthroughZones = useGameStore((s) => s.setPassthroughZones)

  useEffect(() => {
    const scoreZone = { x: 0, y: 0, width: 200, height: 60 }
    const waveZone = { x: window.innerWidth - 200, y: 0, width: 200, height: 60 }
    const statsZone = { x: 10, y: 55, width: 160, height: 120 }
    const controlBarZone = { x: 0, y: window.innerHeight - 70, width: window.innerWidth, height: 70 }
    const connectionStatusZone = { x: window.innerWidth - 130, y: 10, width: 120, height: 40 }
    setPassthroughZones([scoreZone, waveZone, statsZone, controlBarZone, connectionStatusZone])

    return () => setPassthroughZones([])
  }, [setPassthroughZones])

  const handleJoystickMove = useCallback((dx: number, dy: number) => {
    onInput(createJoystickMessage(dx, dy, false))
  }, [onInput])

  const handleButtonPress = useCallback((buttonId: string, pressed: boolean) => {
    onInput(createButtonMessage(buttonId, pressed, false))
  }, [onInput])

  const handleJoystickDrag = useCallback((newX: number, newY: number) => {
    updateTouchLayout({ joystick: { x: Math.max(0, newX), y: Math.max(0, newY) } })
  }, [updateTouchLayout])

  const handleButtonADrag = useCallback((newX: number, newY: number) => {
    updateTouchLayout({ buttonA: { x: Math.max(0, newX), y: Math.max(0, newY) } })
  }, [updateTouchLayout])

  const handleButtonBDrag = useCallback((newX: number, newY: number) => {
    updateTouchLayout({ buttonB: { x: Math.max(0, newX), y: Math.max(0, newY) } })
  }, [updateTouchLayout])

  if (!showTouchControls) return null

  return (
    <div className="touch-overlay-container pointer-events-none absolute inset-0 z-20">
      <div className="pointer-events-auto">
        <VirtualJoystick
          x={touchLayout.joystick.x}
          y={touchLayout.joystick.y}
          onMove={handleJoystickMove}
          onDrag={handleJoystickDrag}
          size={130}
        />
      </div>
      <div className="pointer-events-auto">
        <VirtualButton
          x={touchLayout.buttonA.x}
          y={touchLayout.buttonA.y}
          label="A"
          buttonId="a"
          color="var(--red)"
          size={72}
          onPress={handleButtonPress}
          onDrag={handleButtonADrag}
        />
      </div>
      <div className="pointer-events-auto">
        <VirtualButton
          x={touchLayout.buttonB.x}
          y={touchLayout.buttonB.y}
          label="B"
          buttonId="b"
          color="var(--cyan)"
          size={64}
          onPress={handleButtonPress}
          onDrag={handleButtonBDrag}
        />
      </div>
    </div>
  )
}
