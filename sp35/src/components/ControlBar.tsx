import { useState, useEffect, useCallback, useRef } from 'react'
import { Maximize, Minimize, Volume2, VolumeX, LogOut } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import RecordingControls from './RecordingControls'
import SettingsPanel from './SettingsPanel'
import { useTranslation } from '@/hooks/useTranslation'
import { createQualityChangeRequest } from '@/utils/protocol'
import type { QualityLevel } from '../../shared/types'

interface ControlBarProps {
  onExit: () => void
  onSendMessage?: (msg: any) => void
}

export default function ControlBar({ onExit, onSendMessage }: ControlBarProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(true)
  const isFullscreen = useGameStore((s) => s.isFullscreen)
  const isMuted = useGameStore((s) => s.isMuted)
  const setFullscreen = useGameStore((s) => s.setFullscreen)
  const setMuted = useGameStore((s) => s.setMuted)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const resetTimer = useCallback(() => {
    setVisible(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setVisible(false), 3000)
  }, [])

  useEffect(() => {
    resetTimer()
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [resetTimer])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
      setFullscreen(false)
    } else {
      document.documentElement.requestFullscreen()
      setFullscreen(true)
    }
  }, [setFullscreen])

  const toggleMute = useCallback(() => {
    setMuted(!isMuted)
  }, [isMuted, setMuted])

  const handleQualityChange = useCallback((quality: QualityLevel) => {
    if (onSendMessage) {
      onSendMessage(createQualityChangeRequest(quality))
    }
  }, [onSendMessage])

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 py-4 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onMouseMove={resetTimer}
      onTouchStart={resetTimer}
    >
      <RecordingControls />

      <button
        onClick={toggleFullscreen}
        className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:border-[var(--cyan)] hover:text-[var(--cyan)]"
      >
        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        <span className="hidden sm:inline">{isFullscreen ? t('control.exitFullscreen') : t('control.fullscreen')}</span>
      </button>
      <button
        onClick={toggleMute}
        className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:border-[var(--cyan)] hover:text-[var(--cyan)]"
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        <span className="hidden sm:inline">{isMuted ? t('control.unmute') : t('control.mute')}</span>
      </button>

      <SettingsPanel onQualityChange={handleQualityChange} />

      <button
        onClick={onExit}
        className="flex items-center gap-1 rounded-full border border-[var(--red)]/40 bg-[var(--red)]/10 px-3 py-2 text-sm text-[var(--red)] transition-colors hover:bg-[var(--red)]/20"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">{t('game.exit')}</span>
      </button>
    </div>
  )
}
