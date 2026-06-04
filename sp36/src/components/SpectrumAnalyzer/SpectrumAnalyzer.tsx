import { useEffect, useRef, useCallback, useState } from 'react'
import { Settings, Play, Pause, RefreshCw } from 'lucide-react'
import type { SpectrumAnalyzerConfig, SpectrumData } from '@/types/audio'
import { DEFAULT_SPECTRUM_CONFIG } from '@/types/audio'

interface SpectrumAnalyzerProps {
  audioContext?: AudioContext | null
  sourceNode?: AudioNode | null
  width?: number
  height?: number
}

const FREQUENCY_LABELS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]

export function SpectrumAnalyzer({
  audioContext,
  sourceNode,
  width = 800,
  height = 200,
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [config, setConfig] = useState<SpectrumAnalyzerConfig>(DEFAULT_SPECTRUM_CONFIG)
  const [spectrumData, setSpectrumData] = useState<SpectrumData | null>(null)

  const initAnalyzer = useCallback(() => {
    if (!audioContext || !sourceNode) return

    const analyser = audioContext.createAnalyser()
    analyser.fftSize = config.fftSize
    analyser.smoothingTimeConstant = config.smoothingTimeConstant
    analyser.minDecibels = config.minDecibels
    analyser.maxDecibels = config.maxDecibels

    sourceNode.connect(analyser)
    analyserRef.current = analyser
  }, [audioContext, sourceNode, config])

  const drawSpectrum = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) {
      animationRef.current = requestAnimationFrame(drawSpectrum)
      return
    }

    if (isPaused) {
      animationRef.current = requestAnimationFrame(drawSpectrum)
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    analyser.getByteFrequencyData(dataArray)

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, width, height)

    const barWidth = (width / bufferLength) * 2.5
    const frequencies = new Float32Array(bufferLength)
    const magnitudes = new Float32Array(bufferLength)

    for (let i = 0; i < bufferLength; i++) {
      const x = i * barWidth
      const barHeight = (dataArray[i] / 255) * (height - 30)

      const hue = (i / bufferLength) * 120 + 180
      const gradient = ctx.createLinearGradient(x, height - 30, x, height - 30 - barHeight)
      gradient.addColorStop(0, `hsl(${hue}, 80%, 50%)`)
      gradient.addColorStop(1, `hsl(${hue}, 80%, 70%)`)

      ctx.fillStyle = gradient
      ctx.fillRect(x, height - 30 - barHeight, barWidth - 1, barHeight)

      frequencies[i] = (i * (audioContext?.sampleRate || 44100)) / analyser.fftSize
      magnitudes[i] = dataArray[i] / 255
    }

    ctx.fillStyle = '#6b7280'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'

    FREQUENCY_LABELS.forEach((freq) => {
      const x = (Math.log10(freq / 20) / Math.log10(20000 / 20)) * width
      if (x >= 0 && x <= width) {
        ctx.fillText(freq >= 1000 ? `${freq / 1000}k` : `${freq}`, x, height - 10)
      }
    })

    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 0.5
    for (let db = config.minDecibels; db <= config.maxDecibels; db += 20) {
      const y = height - 30 - ((db - config.minDecibels) / (config.maxDecibels - config.minDecibels)) * (height - 30)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    setSpectrumData({
      frequencies,
      magnitudes,
      sampleRate: audioContext?.sampleRate || 44100,
      fftSize: config.fftSize,
    })

    animationRef.current = requestAnimationFrame(drawSpectrum)
  }, [width, height, isPaused, config, audioContext])

  const updateConfig = useCallback((newConfig: Partial<SpectrumAnalyzerConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig }
      if (analyserRef.current) {
        analyserRef.current.fftSize = updated.fftSize
        analyserRef.current.smoothingTimeConstant = updated.smoothingTimeConstant
        analyserRef.current.minDecibels = updated.minDecibels
        analyserRef.current.maxDecibels = updated.maxDecibels
      }
      return updated
    })
  }, [])

  const resetConfig = useCallback(() => {
    updateConfig(DEFAULT_SPECTRUM_CONFIG)
  }, [updateConfig])

  useEffect(() => {
    if (audioContext && sourceNode) {
      initAnalyzer()
      return () => {
        if (analyserRef.current) {
          sourceNode.disconnect(analyserRef.current)
          analyserRef.current.disconnect()
        }
      }
    }
  }, [audioContext, sourceNode, initAnalyzer])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(drawSpectrum)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [drawSpectrum])

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium text-sm">频谱分析仪</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title={isPaused ? '继续' : '暂停'}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded transition-colors ${
              showSettings ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="设置"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={resetConfig}
            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="重置"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-3 p-3 bg-gray-800 rounded-lg text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 block mb-1">FFT大小: {config.fftSize}</label>
              <select
                value={config.fftSize}
                onChange={(e) => updateConfig({ fftSize: parseInt(e.target.value) })}
                className="w-full bg-gray-700 text-white rounded px-2 py-1"
              >
                <option value={256}>256</option>
                <option value={512}>512</option>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
                <option value={8192}>8192</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">平滑系数: {config.smoothingTimeConstant.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.smoothingTimeConstant}
                onChange={(e) => updateConfig({ smoothingTimeConstant: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">最小dB: {config.minDecibels}</label>
              <input
                type="range"
                min="-120"
                max="-40"
                step="5"
                value={config.minDecibels}
                onChange={(e) => updateConfig({ minDecibels: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">最大dB: {config.maxDecibels}</label>
              <input
                type="range"
                min="-20"
                max="20"
                step="5"
                value={config.maxDecibels}
                onChange={(e) => updateConfig({ maxDecibels: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="text-gray-400 block mb-1">窗函数</label>
            <select
              value={config.windowFunction}
              onChange={(e) => updateConfig({ windowFunction: e.target.value as any })}
              className="w-full bg-gray-700 text-white rounded px-2 py-1"
            >
              <option value="hann">Hann</option>
              <option value="hamming">Hamming</option>
              <option value="blackman">Blackman</option>
              <option value="rectangular">Rectangular</option>
            </select>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{ width, height: height - 20 }}
        className="block rounded bg-gray-800"
      />

      {spectrumData && (
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>采样率: {spectrumData.sampleRate}Hz</span>
          <span>FFT: {spectrumData.fftSize}</span>
          <span>频段数: {spectrumData.frequencies.length}</span>
        </div>
      )}
    </div>
  )
}
