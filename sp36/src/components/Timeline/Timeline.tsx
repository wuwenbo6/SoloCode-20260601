import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { TimelineTrack } from './TimelineTrack'
import { TrackControl } from '@/components/TrackControl/TrackControl'
import { useAudioStore } from '@/store/useAudioStore'
import { formatTimeSimple } from '@/utils/audioUtils'

const TRACK_HEIGHT = 100
const BUFFER_TRACKS = 2

export function Timeline() {
  const {
    tracks,
    waveformData,
    selectedTrackId,
    selectTrack,
    currentTime,
    setCurrentTime,
    zoom,
    setZoom,
    scrollLeft,
    setScrollLeft,
    project,
    setSelectedEffectType,
  } = useAudioStore()

  const timelineRef = useRef<HTMLDivElement>(null)
  const trackContainerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  const pixelsPerSecond = 100 * zoom

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / TRACK_HEIGHT) - BUFFER_TRACKS)
    const endIndex = Math.min(
      tracks.length,
      Math.ceil((scrollTop + containerHeight) / TRACK_HEIGHT) + BUFFER_TRACKS
    )
    return { startIndex, endIndex }
  }, [scrollTop, containerHeight, tracks.length])

  const visibleTracks = useMemo(() => {
    return tracks.slice(visibleRange.startIndex, visibleRange.endIndex)
  }, [tracks, visibleRange.startIndex, visibleRange.endIndex])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setZoom(zoom * delta)
      } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setScrollLeft(scrollLeft + (e.deltaX || e.deltaY))
      } else {
        setScrollTop(prev => Math.max(0, prev + e.deltaY))
      }
    },
    [zoom, scrollLeft, setZoom, setScrollLeft]
  )

  useEffect(() => {
    const element = timelineRef.current
    if (element) {
      element.addEventListener('wheel', handleWheel, { passive: false })
      return () => element.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  useEffect(() => {
    const updateHeight = () => {
      if (trackContainerRef.current) {
        setContainerHeight(trackContainerRef.current.clientHeight)
      }
    }
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  useEffect(() => {
    if (trackContainerRef.current && trackContainerRef.current.scrollTop !== scrollTop) {
      trackContainerRef.current.scrollTop = scrollTop
    }
  }, [scrollTop])

  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left + scrollLeft
    const time = clickX / pixelsPerSecond
    setCurrentTime(Math.max(0, Math.min(project.duration, time)))
  }

  const totalWidth = project.duration * pixelsPerSecond
  const playheadPosition = currentTime * pixelsPerSecond - scrollLeft
  const totalTrackHeight = tracks.length * TRACK_HEIGHT

  const renderRuler = () => {
    const marks = []
    const interval = zoom > 2 ? 0.5 : zoom > 1 ? 1 : 5
    for (let t = 0; t <= project.duration; t += interval) {
      const x = t * pixelsPerSecond - scrollLeft
      if (x >= -50 && x <= totalWidth + 50) {
        marks.push(
          <div
            key={t}
            className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
            style={{ left: x }}
          >
            <span className="text-xs text-gray-400 mt-1">{formatTimeSimple(t)}</span>
            <div className="w-px h-2 bg-gray-600 mt-auto" />
          </div>
        )
      }
    }
    return marks
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-900">
      <div className="flex h-8 border-b border-gray-700 bg-gray-800">
        <div className="w-[200px] flex-shrink-0 border-r border-gray-700 flex items-center px-3">
          <span className="text-xs text-gray-400">轨道</span>
        </div>
        <div
          className="flex-1 relative overflow-hidden cursor-pointer"
          onClick={handleRulerClick}
        >
          {renderRuler()}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          ref={trackContainerRef}
          className="w-[200px] flex-shrink-0 overflow-y-auto bg-gray-800/50"
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div style={{ height: totalTrackHeight, position: 'relative' }}>
            {visibleTracks.map((track) => (
              <div
                key={track.id}
                style={{
                  position: 'absolute',
                  top: tracks.findIndex(t => t.id === track.id) * TRACK_HEIGHT,
                  width: '100%',
                  height: TRACK_HEIGHT,
                }}
              >
                <TrackControl
                  track={track}
                  onSelectEffects={() => {
                    selectTrack(track.id)
                    setSelectedEffectType('compressor')
                  }}
                />
              </div>
            ))}
            {tracks.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                拖拽音频文件到此处或点击导入
              </div>
            )}
          </div>
        </div>

        <div
          ref={timelineRef}
          className="flex-1 overflow-hidden relative"
        >
          <div
            style={{
              height: totalTrackHeight,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              className="absolute top-0 left-0 transition-transform"
              style={{
                transform: `translateX(${-scrollLeft}px)`,
                width: totalWidth,
              }}
            >
              {visibleTracks.map((track) => {
                const trackIndex = tracks.findIndex(t => t.id === track.id)
                return (
                  <div
                    key={track.id}
                    style={{
                      position: 'absolute',
                      top: trackIndex * TRACK_HEIGHT,
                      width: '100%',
                      height: TRACK_HEIGHT,
                    }}
                  >
                    <TimelineTrack
                      track={track}
                      waveformData={waveformData.get(track.id) || null}
                      pixelsPerSecond={pixelsPerSecond}
                      isSelected={selectedTrackId === track.id}
                      onSelect={() => selectTrack(track.id)}
                      visibleStartX={scrollLeft}
                      visibleEndX={scrollLeft + (timelineRef.current?.clientWidth || 0)}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
            style={{ left: playheadPosition }}
          >
            <div className="w-3 h-3 -ml-1 bg-red-500 rounded-full" />
          </div>

          {tracks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">🎵 开始您的音频编辑之旅</p>
                <p className="text-sm">点击左上角 "导入音频" 按钮添加音频文件</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
