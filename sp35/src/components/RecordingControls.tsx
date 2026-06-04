import { useCallback, useState } from 'react'
import { Video, VideoOff, Download, Clock } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useTranslation } from '@/hooks/useTranslation'
import { exportHighlight, formatDuration, getBufferStats } from '@/utils/recording'

export default function RecordingControls() {
  const { t } = useTranslation()
  const isRecording = useGameStore((s) => s.isRecording)
  const recordingBuffer = useGameStore((s) => s.recordingBuffer)
  const recordingDuration = useGameStore((s) => s.recordingDuration)
  const quality = useGameStore((s) => s.quality)
  const gameScore = useGameStore((s) => s.streamStats.gameScore)
  const toggleRecording = useGameStore((s) => s.toggleRecording)
  const saveHighlight = useGameStore((s) => s.saveHighlight)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const showNotification = useCallback((message: string) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }, [])

  const handleToggleRecording = useCallback(() => {
    toggleRecording()
    showNotification(isRecording ? t('recording.stopped') : t('recording.started'))
  }, [toggleRecording, isRecording, showNotification, t])

  const handleSaveHighlight = useCallback(() => {
    const frames = saveHighlight()
    if (frames.length > 0) {
      exportHighlight(frames, quality, gameScore)
      showNotification(t('recording.saved'))
    }
  }, [saveHighlight, quality, gameScore, showNotification, t])

  const stats = getBufferStats(recordingBuffer)

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggleRecording}
        className={`flex items-center gap-1 rounded-full border bg-white/10 px-3 py-2 text-sm transition-colors ${
          isRecording
            ? 'border-[var(--red)] bg-[var(--red)]/20 text-[var(--red)]'
            : 'border-white/20 text-white hover:border-[var(--cyan)] hover:text-[var(--cyan)]'
        }`}
        title={isRecording ? t('control.stopRecording') : t('control.record')}
      >
        {isRecording ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--red)]" />
            <Video size={16} />
          </>
        ) : (
          <VideoOff size={16} />
        )}
        {isRecording && (
          <span className="text-xs">
            <Clock size={12} className="mr-1 inline" />
            {formatDuration(recordingDuration)}
          </span>
        )}
      </button>

      <button
        onClick={handleSaveHighlight}
        disabled={recordingBuffer.length === 0}
        className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:border-[var(--cyan)] hover:text-[var(--cyan)] disabled:opacity-50"
        title={t('control.saveHighlight')}
      >
        <Download size={16} />
        <span className="hidden sm:inline">{t('control.saveHighlight')}</span>
        {recordingBuffer.length > 0 && (
          <span className="ml-1 rounded bg-[var(--cyan)]/20 px-1 text-xs text-[var(--cyan)]">
            {stats.count}
          </span>
        )}
      </button>

      {showToast && (
        <div className="absolute top-full mt-2 rounded bg-black/80 px-4 py-2 text-sm text-white">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
