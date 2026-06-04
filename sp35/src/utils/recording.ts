import type { RecordingFrame, RecordingData, QualityLevel } from '../../shared/types'

export function saveRecording(
  frames: RecordingFrame[],
  quality: QualityLevel,
  gameScore: number,
  filename?: string
): void {
  if (frames.length === 0) return

  const recordingData: RecordingData = {
    startTime: frames[0].timestamp,
    endTime: frames[frames.length - 1].timestamp,
    frames,
    gameScore,
    quality,
  }

  const blob = new Blob([JSON.stringify(recordingData)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `game-recording-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportHighlight(
  frames: RecordingFrame[],
  quality: QualityLevel,
  gameScore: number
): void {
  saveRecording(frames, quality, gameScore, `highlight-${Date.now()}.json`)
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${seconds}s`
}

export function getBufferStats(frames: RecordingFrame[]): { count: number; duration: number; size: string } {
  if (frames.length === 0) {
    return { count: 0, duration: 0, size: '0 KB' }
  }

  const duration = frames[frames.length - 1].timestamp - frames[0].timestamp
  const size = new Blob([JSON.stringify(frames)]).size
  const kbSize = (size / 1024).toFixed(1)

  return {
    count: frames.length,
    duration,
    size: `${kbSize} KB`,
  }
}
