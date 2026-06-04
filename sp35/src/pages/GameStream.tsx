import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameStream } from '@/hooks/useGameStream'
import { useGameStore } from '@/stores/gameStore'
import VideoRenderer from '@/components/VideoRenderer'
import InputCapture from '@/components/InputCapture'
import TouchOverlay from '@/components/TouchOverlay'
import StatsPanel from '@/components/StatsPanel'
import ControlBar from '@/components/ControlBar'
import ConnectionStatus from '@/components/ConnectionStatus'
import { RotateCcw } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export default function GameStream() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { frameObjects, connected, send, disconnect } = useGameStream()
  const isTouchDevice = useGameStore((s) => s.isTouchDevice)
  const setTouchDevice = useGameStore((s) => s.setTouchDevice)
  const showOrientationWarning = useGameStore((s) => s.showOrientationWarning)
  const setOrientationWarning = useGameStore((s) => s.setOrientationWarning)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const { t } = useTranslation()

  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setTouchDevice(isTouch)

    function handleResize() {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight })
      const isPortrait = window.innerHeight > window.innerWidth
      setOrientationWarning(isTouch && isPortrait)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setTouchDevice, setOrientationWarning])

  const handleInput = useCallback((msg: Parameters<typeof send>[0]) => {
    send(msg)
  }, [send])

  const handleExit = useCallback(() => {
    disconnect()
    navigate('/')
  }, [disconnect, navigate])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <VideoRenderer
        objects={frameObjects}
        width={canvasSize.width}
        height={canvasSize.height}
      />

      {!isTouchDevice && (
        <InputCapture onInput={handleInput} enabled={connected} />
      )}

      {isTouchDevice && (
        <TouchOverlay onInput={handleInput} />
      )}

      {isTouchDevice && connected && (
        <InputCapture onInput={handleInput} enabled={connected} />
      )}

      <div className="absolute top-3 right-3 z-20">
        <ConnectionStatus />
      </div>

      <StatsPanel />
      <ControlBar onExit={handleExit} onSendMessage={send} />

      {!connected && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--cyan)] border-t-transparent" />
          <p className="mt-4 font-heading text-sm text-[var(--cyan)]">{t('game.connecting', { gameId: gameId || '' })}</p>
        </div>
      )}

      {showOrientationWarning && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
          <RotateCcw size={48} className="text-[var(--cyan)] animate-bounce" />
          <p className="mt-4 font-heading text-lg text-white">{t('orientation.warning')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('orientation.hint')}</p>
        </div>
      )}
    </div>
  )
}
