import { useEffect, useRef, useCallback } from 'react'
import type { WaveformData } from '@/types/audio'

interface WaveformCanvasProps {
  waveformData: WaveformData | null
  color: string
  width: number
  height: number
  startSample?: number
  endSample?: number
  isSelected?: boolean
  isMuted?: boolean
  offsetX?: number
  totalWidth?: number
}

export function WaveformCanvas({
  waveformData,
  color,
  width,
  height,
  startSample = 0,
  endSample = 0,
  isSelected = false,
  isMuted = false,
  offsetX = 0,
  totalWidth,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !waveformData || waveformData.peaks.length === 0 || width <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const { peaks } = waveformData
    const totalPoints = peaks.length / 2
    const actualTotalWidth = totalWidth || width
    const samplesPerPixel = totalPoints / actualTotalWidth

    const startPoint = Math.floor(startSample * samplesPerPixel)
    const endPoint = Math.floor(endSample * samplesPerPixel) || totalPoints
    const offsetPoints = Math.floor(offsetX * samplesPerPixel)

    ctx.beginPath()
    ctx.strokeStyle = isMuted ? '#4b5563' : color
    ctx.lineWidth = isSelected ? 1.5 : 1
    ctx.globalAlpha = isMuted ? 0.5 : 1

    const centerY = height / 2
    const amplitude = height / 2 - 4

    for (let x = 0; x < width; x++) {
      const pointIndex = offsetPoints + Math.floor(x * samplesPerPixel)
      if (pointIndex < startPoint || pointIndex >= endPoint) continue

      const peakIndex = pointIndex * 2
      const min = peaks[peakIndex] || 0
      const max = peaks[peakIndex + 1] || 0

      const yMin = centerY - min * amplitude
      const yMax = centerY - max * amplitude

      ctx.moveTo(x, yMin)
      ctx.lineTo(x, yMax)
    }

    ctx.stroke()

    if (isSelected) {
      ctx.fillStyle = color
      ctx.globalAlpha = 0.1
      ctx.fillRect(0, 0, width, height)
    }
  }, [waveformData, color, width, height, startSample, endSample, isSelected, isMuted, offsetX, totalWidth])

  useEffect(() => {
    drawWaveform()
  }, [drawWaveform])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block"
    />
  )
}
