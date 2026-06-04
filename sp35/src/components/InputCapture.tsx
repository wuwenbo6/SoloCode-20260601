import { useEffect, useCallback, useRef } from 'react'
import { useGameStore } from '@/stores/gameStore'
import type { ClientMessage } from '../../shared/types'
import { createInputEvent } from '@/utils/protocol'

interface InputCaptureProps {
  onInput: (msg: ClientMessage) => void
  enabled: boolean
}

const VALID_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'w', 'a', 's', 'd', 'W', 'A', 'S', 'D',
  ' ', 'Enter',
])

export default function InputCapture({ onInput, enabled }: InputCaptureProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onInputRef = useRef(onInput)
  onInputRef.current = onInput
  const isTouchDevice = useGameStore((s) => s.isTouchDevice)
  const isPointInPassthroughZone = useGameStore((s) => s.isPointInPassthroughZone)

  const shouldPassthrough = useCallback((clientX: number, clientY: number): boolean => {
    if (!containerRef.current) return false
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    return isPointInPassthroughZone(x, y)
  }, [isPointInPassthroughZone])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled) return
    if (isTouchDevice && shouldPassthrough(e.clientX, e.clientY)) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    e.preventDefault()
    onInputRef.current(createInputEvent('mousedown', {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      button: e.button,
    }))
  }, [enabled, isTouchDevice, shouldPassthrough])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!enabled) return
    if (isTouchDevice && shouldPassthrough(e.clientX, e.clientY)) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    e.preventDefault()
    onInputRef.current(createInputEvent('mouseup', {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      button: e.button,
    }))
  }, [enabled, isTouchDevice, shouldPassthrough])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!enabled) return
    if (isTouchDevice && shouldPassthrough(e.clientX, e.clientY)) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    onInputRef.current(createInputEvent('mousemove', {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }))
  }, [enabled, isTouchDevice, shouldPassthrough])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    if (isTouchDevice) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    e.preventDefault()
    const touches = Array.from(e.touches).map((t) => ({
      id: t.identifier,
      x: (t.clientX - rect.left) / rect.width,
      y: (t.clientY - rect.top) / rect.height,
    }))
    onInputRef.current(createInputEvent('touchstart', { touches }))
  }, [enabled, isTouchDevice])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    if (isTouchDevice) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    e.preventDefault()
    const touches = Array.from(e.touches).map((t) => ({
      id: t.identifier,
      x: (t.clientX - rect.left) / rect.width,
      y: (t.clientY - rect.top) / rect.height,
    }))
    onInputRef.current(createInputEvent('touchmove', { touches }))
  }, [enabled, isTouchDevice])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    if (isTouchDevice) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    e.preventDefault()
    const touches = Array.from(e.changedTouches).map((t) => ({
      id: t.identifier,
      x: (t.clientX - rect.left) / rect.width,
      y: (t.clientY - rect.top) / rect.height,
    }))
    onInputRef.current(createInputEvent('touchend', { touches }))
  }, [enabled, isTouchDevice])

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      if (VALID_KEYS.has(e.key)) {
        e.preventDefault()
        onInputRef.current(createInputEvent('keydown', { key: e.key }))
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (VALID_KEYS.has(e.key)) {
        e.preventDefault()
        onInputRef.current(createInputEvent('keyup', { key: e.key }))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [enabled])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{ pointerEvents: enabled ? 'auto' : 'none' }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  )
}
