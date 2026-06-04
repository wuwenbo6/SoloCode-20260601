import { useState, useEffect, useRef } from 'react'
import { useRobotStore } from '@/store/robotStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  Video,
  Play,
  Pause,
  Square,
  Trash2,
  Clock,
  Film,
  HardDrive,
  SkipBack,
  SkipForward,
  RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'
import type { RecordingInfo } from '@/types'

const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function RecordingPanel() {
  const isRecording = useRobotStore((s) => s.isRecording)
  const recordings = useRobotStore((s) => s.recordings)
  const selectedRobotId = useRobotStore((s) => s.selectedRobotId)
  const robots = useRobotStore((s) => s.robots)
  const isPlaying = useRobotStore((s) => s.isPlaying)
  const playbackFrameIndex = useRobotStore((s) => s.playbackFrameIndex)
  const playbackRecordingId = useRobotStore((s) => s.playbackRecordingId)
  const startRecording = useRobotStore((s) => s.startRecording)
  const stopRecording = useRobotStore((s) => s.stopRecording)
  const setPlaybackState = useRobotStore((s) => s.setPlaybackState)

  const { controlRecording } = useWebSocket()

  const [recordingStartTime, setRecordingStartTime] = useState<number>(0)
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentRecording = recordings.find((r) => r.id === playbackRecordingId)
  const totalFrames = currentRecording?.frameCount || 0

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - recordingStartTime)
      }, 100)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setElapsedTime(0)
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRecording, recordingStartTime])

  const handleStartRecording = () => {
    const recordingId = `rec-${Date.now()}`
    controlRecording('start', recordingId)
    startRecording(recordingId)
    setRecordingStartTime(Date.now())
  }

  const handleStopRecording = () => {
    controlRecording('stop')
    stopRecording()
    setTimeout(() => {
      controlRecording('list')
    }, 500)
  }

  const handlePlayRecording = (recording: RecordingInfo) => {
    if (playbackRecordingId === recording.id && isPlaying) {
      controlRecording('pause')
      setPlaybackState({ isPlaying: false })
    } else {
      controlRecording('play', recording.id, 0)
      setPlaybackState({
        isPlaying: true,
        playbackRecordingId: recording.id,
        playbackFrameIndex: 0,
      })
    }
  }

  const handlePausePlayback = () => {
    controlRecording('pause')
    setPlaybackState({ isPlaying: false })
  }

  const handleResumePlayback = () => {
    if (playbackRecordingId) {
      controlRecording('play', playbackRecordingId, playbackFrameIndex)
      setPlaybackState({ isPlaying: true })
    }
  }

  const handleDeleteRecording = (recordingId: string) => {
    if (playbackRecordingId === recordingId) {
      setPlaybackState({
        isPlaying: false,
        playbackRecordingId: null,
        playbackFrameIndex: 0,
        playbackFrameData: '',
      })
    }
    controlRecording('list')
  }

  const handleFrameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(e.target.value)
    if (playbackRecordingId) {
      controlRecording('play', playbackRecordingId, frame)
      setPlaybackState({ playbackFrameIndex: frame })
    }
  }

  const handleSkipBack = () => {
    const newFrame = Math.max(0, playbackFrameIndex - 30)
    if (playbackRecordingId) {
      controlRecording('play', playbackRecordingId, newFrame)
      setPlaybackState({ playbackFrameIndex: newFrame })
    }
  }

  const handleSkipForward = () => {
    const newFrame = Math.min(totalFrames - 1, playbackFrameIndex + 30)
    if (playbackRecordingId) {
      controlRecording('play', playbackRecordingId, newFrame)
      setPlaybackState({ playbackFrameIndex: newFrame })
    }
  }

  const handleRefreshList = () => {
    controlRecording('list')
  }

  const getRobotName = (robotId: string) => {
    const robot = robots.find((r) => r.id === robotId)
    return robot?.name || robotId
  }

  return (
    <div className="bg-[#1a1f2e] rounded-lg border border-[#2a3040] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3040]">
        <div className="flex items-center gap-2">
          <Video size={16} className="text-[#00ff88]" />
          <span className="text-sm font-display tracking-wider text-[#00ff88]">
            RECORDING & PLAYBACK
          </span>
        </div>
        <button
          onClick={handleRefreshList}
          className="p-1.5 rounded bg-[#0a0e17] border border-[#2a3040] text-[#888] hover:text-[#00ff88] hover:border-[#00ff88] transition-colors"
          title="Refresh List"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={!selectedRobotId}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded text-sm font-mono font-bold transition-all duration-200 border-2 flex-1',
              isRecording
                ? 'bg-[#ff3366]/20 border-[#ff3366] text-[#ff3366] hover:bg-[#ff3366]/30'
                : 'bg-[#0a0e17] border-[#2a3040] text-[#888] hover:border-[#ff3366] hover:text-[#ff3366] disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isRecording ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="recording-pulse absolute inline-flex h-full w-full rounded-full bg-[#ff3366] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff3366]"></span>
                </span>
                STOP RECORDING
              </>
            ) : (
              <>
                <Square size={12} className="fill-[#ff3366]" />
                START RECORDING
              </>
            )}
          </button>

          {isRecording && (
            <div className="flex items-center gap-2 text-xs font-mono text-[#ff3366] bg-[#0a0e17] px-3 py-2 rounded border border-[#ff3366]/50">
              <Clock size={12} />
              <span>{formatDuration(elapsedTime)}</span>
            </div>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 text-xs font-mono text-[#888]">
            <span className="text-[#ff3366]">●</span>
            <span>Recording robot: </span>
            <span className="text-[#00ff88]">{selectedRobotId && getRobotName(selectedRobotId)}</span>
          </div>
        )}

        {playbackRecordingId && currentRecording && (
          <div className="bg-[#0a0e17] rounded-lg border border-[#2a3040] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film size={14} className="text-[#00aaff]" />
                <span className="text-xs font-mono text-[#00aaff]">NOW PLAYING</span>
              </div>
              <span className="text-xs font-mono text-[#888]">
                {currentRecording.id.slice(-8)}
              </span>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleSkipBack}
                className="p-2 rounded bg-[#1a1f2e] border border-[#2a3040] text-[#888] hover:text-[#00aaff] hover:border-[#00aaff] transition-colors"
              >
                <SkipBack size={16} />
              </button>
              <button
                onClick={isPlaying ? handlePausePlayback : handleResumePlayback}
                className="p-3 rounded-full bg-[#00aaff]/20 border-2 border-[#00aaff] text-[#00aaff] hover:bg-[#00aaff]/30 transition-colors"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
              <button
                onClick={handleSkipForward}
                className="p-2 rounded bg-[#1a1f2e] border border-[#2a3040] text-[#888] hover:text-[#00aaff] hover:border-[#00aaff] transition-colors"
              >
                <SkipForward size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={Math.max(0, totalFrames - 1)}
                value={playbackFrameIndex}
                onChange={handleFrameChange}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#888]">
                <span>
                  {formatDuration((playbackFrameIndex / 30) * 1000)} / {formatDuration((totalFrames / 30) * 1000)}
                </span>
                <span>
                  Frame {playbackFrameIndex} / {totalFrames}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-[#888]">
              <HardDrive size={12} />
              <span>RECORDINGS ({recordings.length})</span>
            </div>
          </div>

          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {recordings.length === 0 ? (
              <div className="text-center py-8 text-[#555] text-xs font-mono">
                <Film size={32} className="mx-auto mb-2 opacity-30" />
                <p>No recordings yet</p>
                <p className="text-[10px] mt-1">Click START RECORDING to begin</p>
              </div>
            ) : (
              [...recordings]
                .sort((a, b) => b.startTime - a.startTime)
                .map((recording) => {
                  const duration = recording.endTime - recording.startTime
                  const isActive = playbackRecordingId === recording.id

                  return (
                    <div
                      key={recording.id}
                      className={clsx(
                        'bg-[#0a0e17] rounded border p-3 transition-colors',
                        isActive
                          ? 'border-[#00aaff]'
                          : 'border-[#2a3040] hover:border-[#3a4050]'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs font-mono text-white mb-1">
                            {getRobotName(recording.robotId)}
                          </div>
                          <div className="text-[10px] font-mono text-[#888]">
                            {formatTime(recording.startTime)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handlePlayRecording(recording)}
                            className={clsx(
                              'p-1.5 rounded transition-colors',
                              isActive && isPlaying
                                ? 'bg-[#00aaff]/20 text-[#00aaff]'
                                : 'bg-[#1a1f2e] text-[#888] hover:text-[#00ff88]'
                            )}
                            title={isActive && isPlaying ? 'Pause' : 'Play'}
                          >
                            {isActive && isPlaying ? (
                              <Pause size={12} />
                            ) : (
                              <Play size={12} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteRecording(recording.id)}
                            className="p-1.5 rounded bg-[#1a1f2e] text-[#888] hover:text-[#ff3366] transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-[#555]">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatDuration(duration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Film size={10} />
                          {recording.frameCount} frames
                        </span>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
