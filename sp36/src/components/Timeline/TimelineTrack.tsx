import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { WaveformCanvas } from '@/components/Waveform/WaveformCanvas'
import type { Track, WaveformData } from '@/types/audio'
import { useAudioStore } from '@/store/useAudioStore'

interface TimelineTrackProps {
  track: Track
  waveformData: WaveformData | null
  pixelsPerSecond: number
  isSelected: boolean
  onSelect: () => void
  visibleStartX?: number
  visibleEndX?: number
}

export function TimelineTrack({
  track,
  waveformData,
  pixelsPerSecond,
  isSelected,
  onSelect,
  visibleStartX = 0,
  visibleEndX = 0,
}: TimelineTrackProps) {
  const { updateTrack, setCurrentTime, currentTime } = useAudioStore()
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragType, setDragType] = useState<'move' | 'trimStart' | 'trimEnd' | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartTime, setDragStartTime] = useState(0)

  const trackWidth = (track.duration - track.trimStart - track.trimEnd) * pixelsPerSecond
  const trackLeft = track.startTime * pixelsPerSecond
  const trackHeight = 100

  const isVisible = useMemo(() => {
    if (visibleEndX === 0) return true
    const trackRight = trackLeft + trackWidth
    const padding = 100
    return trackLeft < visibleEndX + padding && trackRight > visibleStartX - padding
  }, [trackLeft, trackWidth, visibleStartX, visibleEndX])

  const renderStartX = useMemo(() => {
    if (visibleStartX === 0 || visibleEndX === 0) return 0
    return Math.max(0, visibleStartX - trackLeft - 50)
  }, [trackLeft, visibleStartX, visibleEndX])

  const renderEndX = useMemo(() => {
    if (visibleStartX === 0 || visibleEndX === 0) return trackWidth
    return Math.min(trackWidth, visibleEndX - trackLeft + 50)
  }, [trackLeft, trackWidth, visibleStartX, visibleEndX])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, type: 'move' | 'trimStart' | 'trimEnd') => {
      e.stopPropagation()
      setIsDragging(true)
      setDragType(type)
      setDragStartX(e.clientX)
      setDragStartTime(track.startTime)
      onSelect()
    },
    [track.startTime, onSelect]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragType) return

      const deltaX = e.clientX - dragStartX
      const deltaTime = deltaX / pixelsPerSecond

      if (dragType === 'move') {
        const newStartTime = Math.max(0, dragStartTime + deltaTime)
        updateTrack(track.id, { startTime: newStartTime })
      } else if (dragType === 'trimStart') {
        const trimDelta = deltaX / pixelsPerSecond
        const maxTrim = track.duration - track.trimEnd - 0.1
        const newTrimStart = Math.max(0, Math.min(maxTrim, track.trimStart - trimDelta))
        const newStartTime = track.startTime + (track.trimStart - newTrimStart)
        updateTrack(track.id, { trimStart: newTrimStart, startTime: newStartTime })
      } else if (dragType === 'trimEnd') {
        const trimDelta = deltaX / pixelsPerSecond
        const maxTrim = track.duration - track.trimStart - 0.1
        const newTrimEnd = Math.max(0, Math.min(maxTrim, track.trimEnd + trimDelta))
        updateTrack(track.id, { trimEnd: newTrimEnd })
      }
    },
    [isDragging, dragType, dragStartX, dragStartTime, pixelsPerSecond, track.id, track]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragType(null)
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      const rect = trackRef.current?.getBoundingClientRect()
      if (rect) {
        const clickX = e.clientX - rect.left
        const time = clickX / pixelsPerSecond
        setCurrentTime(time)
      }
      onSelect()
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div
      ref={trackRef}
      className={`relative border-b border-gray-700 transition-colors ${
        isSelected ? 'bg-indigo-900/20' : 'bg-gray-800/30'
      }`}
      style={{ height: trackHeight }}
      onClick={handleClick}
    >
      <div
        className={`absolute top-2 bottom-2 rounded cursor-move transition-shadow ${
          isSelected ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/20' : ''
        }`}
        style={{
          left: trackLeft,
          width: trackWidth,
          backgroundColor: track.color + '30',
          borderLeft: `3px solid ${track.color}`,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l"
          onMouseDown={(e) => handleMouseDown(e, 'trimStart')}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r"
          onMouseDown={(e) => handleMouseDown(e, 'trimEnd')}
        />

        <div className="absolute inset-0 overflow-hidden">
          {waveformData && isVisible && (
            <div
              style={{
                position: 'absolute',
                left: renderStartX,
                width: renderEndX - renderStartX,
                height: '100%',
              }}
            >
              <WaveformCanvas
                waveformData={waveformData}
                color={track.color}
                width={renderEndX - renderStartX}
                height={trackHeight - 16}
                startSample={track.trimStart + renderStartX / pixelsPerSecond}
                endSample={track.trimStart + renderEndX / pixelsPerSecond}
                isSelected={isSelected}
                isMuted={track.muted}
                offsetX={renderStartX}
                totalWidth={trackWidth}
              />
            </div>
          )}
        </div>

        <div className="absolute bottom-1 left-2 text-xs text-white/70 truncate max-w-full">
          {track.name}
        </div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 cursor-move z-50" />
      )}
    </div>
  )
}
