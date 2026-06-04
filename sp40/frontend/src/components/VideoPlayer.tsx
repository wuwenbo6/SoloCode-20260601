import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Play, Pause } from 'lucide-react'
import { useRobotStore } from '@/store/robotStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import clsx from 'clsx'

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function VideoPlayer() {
  const videoFrame = useRobotStore((s) => s.videoFrame)
  const fps = useRobotStore((s) => s.fps)
  const frameCount = useRobotStore((s) => s.frameCount)
  const isPlaying = useRobotStore((s) => s.isPlaying)
  const playbackFrameData = useRobotStore((s) => s.playbackFrameData)
  const playbackFrameIndex = useRobotStore((s) => s.playbackFrameIndex)
  const playbackRecordingId = useRobotStore((s) => s.playbackRecordingId)
  const recordings = useRobotStore((s) => s.recordings)
  const setPlaybackState = useRobotStore((s) => s.setPlaybackState)

  const { controlRecording } = useWebSocket()

  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevUrlRef = useRef<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const currentRecording = recordings.find((r) => r.id === playbackRecordingId)
  const totalFrames = currentRecording?.frameCount || 0
  const currentTime = (playbackFrameIndex / 30)
  const totalTime = (totalFrames / 30)

  const displayFrame = isPlaying ? playbackFrameData : videoFrame

  useEffect(() => {
    if (!displayFrame) return
    if (prevUrlRef.current && prevUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(prevUrlRef.current)
    }
    prevUrlRef.current = displayFrame
  }, [displayFrame])

  useEffect(() => {
    return () => {
      if (prevUrlRef.current && prevUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(prevUrlRef.current)
      }
    }
  }, [])

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const handlePlayPause = () => {
    if (!playbackRecordingId) return
    if (isPlaying) {
      controlRecording('pause')
      setPlaybackState({ isPlaying: false })
    } else {
      controlRecording('play', playbackRecordingId, playbackFrameIndex)
      setPlaybackState({ isPlaying: true })
    }
  }

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(e.target.value)
    if (playbackRecordingId) {
      controlRecording('play', playbackRecordingId, frame)
      setPlaybackState({ playbackFrameIndex: frame })
    }
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0a0e17] rounded-lg border border-[#2a3040] overflow-hidden">
      <img
        ref={imgRef}
        src={displayFrame || ''}
        className="w-full h-full object-contain scanlines"
        style={{ imageRendering: 'auto' }}
      />
      <div className="absolute inset-0 pointer-events-none scanlines-overlay" />
      <div className="absolute top-2 left-2 text-xs font-mono text-[#00ff88] bg-[#0a0e17]/80 px-2 py-1 rounded border border-[#2a3040]">
        {isPlaying ? 'PLAYBACK' : 'CAM'} • 320x240
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-2">
        {!isPlaying && (
          <>
            <div className="text-xs font-mono text-[#00ff88] bg-[#0a0e17]/80 px-2 py-1 rounded border border-[#2a3040]">
              {fps} FPS
            </div>
            <div className="text-xs font-mono text-[#888] bg-[#0a0e17]/80 px-2 py-1 rounded border border-[#2a3040]">
              #{frameCount}
            </div>
          </>
        )}
        <button
          onClick={toggleFullscreen}
          className="text-[#00ff88] bg-[#0a0e17]/80 p-1 rounded border border-[#2a3040] hover:bg-[#1a1f2e] transition-colors pointer-events-auto"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        {isPlaying ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00aaff] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00aaff]"></span>
          </span>
        ) : (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff3366] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff3366]"></span>
          </span>
        )}
        <span className={clsx(
          'text-xs font-mono',
          isPlaying ? 'text-[#00aaff]' : 'text-[#ff3366]'
        )}>
          {isPlaying ? 'PLAYING' : 'LIVE'}
        </span>
      </div>

      {isPlaying && playbackRecordingId && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0e17] to-transparent p-3 pt-8">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="p-2 rounded-full bg-[#00aaff]/20 border border-[#00aaff] text-[#00aaff] hover:bg-[#00aaff]/30 transition-colors pointer-events-auto"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={Math.max(0, totalFrames - 1)}
                value={playbackFrameIndex}
                onChange={handleScrubChange}
                className="w-full pointer-events-auto"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#888] mt-1">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(totalTime)}</span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#888]">
              FRAME {playbackFrameIndex}/{totalFrames}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
