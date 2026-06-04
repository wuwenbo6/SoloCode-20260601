import { useState } from 'react'
import { X, Volume2, Sliders, Shield } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import type { CompressorParams, EqualizerParams, LimiterParams, EffectChain } from '@/types/audio'

interface EffectsPanelProps {
  effects?: EffectChain
  onUpdateCompressor?: (params: Partial<CompressorParams>) => void
  onUpdateEqualizer?: (params: Partial<EqualizerParams>) => void
  onUpdateLimiter?: (params: Partial<LimiterParams>) => void
  showTitle?: boolean
}

interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

function Knob({ label, value, min, max, step, unit = '', onChange }: KnobProps) {
  const percentage = ((value - min) / (max - min)) * 100
  const rotation = (percentage / 100) * 270 - 135

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-12 h-12">
        <svg className="w-full h-full" viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="#374151"
            strokeWidth="4"
            strokeDasharray="94.25"
            strokeDashoffset="23.56"
            strokeLinecap="round"
            transform="rotate(-135 24 24)"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="4"
            strokeDasharray="94.25"
            strokeDashoffset={94.25 - (percentage / 100) * 70.69}
            strokeLinecap="round"
            transform="rotate(-135 24 24)"
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="w-1 h-4 bg-cyan-400 rounded-full -mt-8" />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs text-cyan-400 font-mono">
        {value.toFixed(step < 1 ? 1 : 0)}{unit}
      </span>
    </div>
  )
}

export function EffectsPanel({
  effects: propsEffects,
  onUpdateCompressor,
  onUpdateEqualizer,
  onUpdateLimiter,
  showTitle = true,
  initialEffectType = 'compressor',
}: EffectsPanelProps & { initialEffectType?: 'compressor' | 'equalizer' | 'limiter' } = {}) {
  const {
    selectedTrackId,
    tracks,
    selectedEffectType: storeEffectType,
    setSelectedEffectType,
    updateTrackEffects,
  } = useAudioStore()

  const [localEffectType, setLocalEffectType] = useState<'compressor' | 'equalizer' | 'limiter'>(initialEffectType)

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId)
  const isStandalone = !!propsEffects

  const currentEffectType = isStandalone ? localEffectType : storeEffectType

  if (!isStandalone && !selectedTrack) {
    return (
      <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 flex items-center justify-center">
        <p className="text-gray-500 text-sm text-center">
          选择一个轨道<br />查看和编辑效果器
        </p>
      </div>
    )
  }

  const effects = isStandalone ? propsEffects! : selectedTrack!.effects

  const updateCompressor = (params: Partial<CompressorParams>) => {
    if (isStandalone && onUpdateCompressor) {
      onUpdateCompressor(params)
    } else {
      updateTrackEffects(selectedTrackId!, {
        compressor: { ...effects.compressor, ...params },
      })
    }
  }

  const updateEqualizer = (params: Partial<EqualizerParams>) => {
    if (isStandalone && onUpdateEqualizer) {
      onUpdateEqualizer(params)
    } else {
      updateTrackEffects(selectedTrackId!, {
        equalizer: { ...effects.equalizer, ...params },
      })
    }
  }

  const updateLimiter = (params: Partial<LimiterParams>) => {
    if (isStandalone && onUpdateLimiter) {
      onUpdateLimiter(params)
    } else {
      updateTrackEffects(selectedTrackId!, {
        limiter: { ...effects.limiter, ...params },
      })
    }
  }

  const updateBand = (index: number, updates: any) => {
    const newBands = [...effects.equalizer.bands]
    newBands[index] = { ...newBands[index], ...updates }
    updateEqualizer({ bands: newBands })
  }

  return (
    <div className={`${isStandalone ? '' : 'w-80'} bg-gray-800 ${!isStandalone ? 'border-l border-gray-700' : ''} flex flex-col`}>
      <div className="p-4 border-b border-gray-700">
        {showTitle && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">效果器链</h3>
            {!isStandalone && (
              <button
                onClick={() => setSelectedEffectType(null)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        )}
        {!isStandalone && (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedTrack.color }}
            />
            <span className="text-sm text-gray-300 truncate">{selectedTrack.name}</span>
          </div>
        )}
      </div>

      <div className="flex border-b border-gray-700">
        {(['compressor', 'equalizer', 'limiter'] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              if (isStandalone) {
                setLocalEffectType(type)
              } else {
                setSelectedEffectType(type)
              }
            }}
            className={`flex-1 py-3 px-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              currentEffectType === type
                ? 'bg-gray-700 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            {type === 'compressor' && <Volume2 size={14} />}
            {type === 'equalizer' && <Sliders size={14} />}
            {type === 'limiter' && <Shield size={14} />}
            {type === 'compressor' && '压缩器'}
            {type === 'equalizer' && '均衡器'}
            {type === 'limiter' && '限制器'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {currentEffectType === 'compressor' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">压缩器</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effects.compressor.phaseInvert}
                    onChange={(e) => updateCompressor({ phaseInvert: e.target.checked })}
                    className="rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-xs text-gray-400">相位翻转</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effects.compressor.bypassed}
                    onChange={(e) => updateCompressor({ bypassed: e.target.checked })}
                    className="rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-xs text-gray-400">旁通</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Knob
                label="阈值"
                value={effects.compressor.threshold}
                min={-60}
                max={0}
                step={0.5}
                unit="dB"
                onChange={(v) => updateCompressor({ threshold: v })}
              />
              <Knob
                label="比率"
                value={effects.compressor.ratio}
                min={1}
                max={20}
                step={0.5}
                unit=":1"
                onChange={(v) => updateCompressor({ ratio: v })}
              />
              <Knob
                label="拐点"
                value={effects.compressor.knee}
                min={0}
                max={20}
                step={0.5}
                unit="dB"
                onChange={(v) => updateCompressor({ knee: v })}
              />
              <Knob
                label="启动"
                value={effects.compressor.attack}
                min={0.1}
                max={100}
                step={1}
                unit="ms"
                onChange={(v) => updateCompressor({ attack: v })}
              />
              <Knob
                label="释放"
                value={effects.compressor.release}
                min={10}
                max={1000}
                step={10}
                unit="ms"
                onChange={(v) => updateCompressor({ release: v })}
              />
              <Knob
                label="补偿"
                value={effects.compressor.makeupGain}
                min={0}
                max={20}
                step={0.5}
                unit="dB"
                onChange={(v) => updateCompressor({ makeupGain: v })}
              />
            </div>
          </div>
        )}

        {currentEffectType === 'equalizer' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">5段均衡器</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effects.equalizer.phaseInvert}
                    onChange={(e) => updateEqualizer({ phaseInvert: e.target.checked })}
                    className="rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-xs text-gray-400">相位翻转</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effects.equalizer.bypassed}
                    onChange={(e) => updateEqualizer({ bypassed: e.target.checked })}
                    className="rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-xs text-gray-400">旁通</span>
                </label>
              </div>
            </div>
            <div className="space-y-4">
              {effects.equalizer.bands.map((band, index) => (
                <div key={index} className="bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">
                      {index === 0 ? '低频' : index === 4 ? '高频' : `频段 ${index + 1}`}
                    </span>
                    <span className="text-xs text-cyan-400 font-mono">{band.frequency}Hz</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={band.gain}
                      onChange={(e) => updateBand(index, { gain: parseFloat(e.target.value) })}
                      className="flex-1 h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-cyan-400"
                    />
                    <span className="text-xs text-gray-300 w-12 text-right font-mono">
                      {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}dB
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentEffectType === 'limiter' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">限制器</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effects.limiter.phaseInvert}
                    onChange={(e) => updateLimiter({ phaseInvert: e.target.checked })}
                    className="rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-xs text-gray-400">相位翻转</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effects.limiter.bypassed}
                    onChange={(e) => updateLimiter({ bypassed: e.target.checked })}
                    className="rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-xs text-gray-400">旁通</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Knob
                label="阈值"
                value={effects.limiter.threshold}
                min={-20}
                max={0}
                step={0.1}
                unit="dB"
                onChange={(v) => updateLimiter({ threshold: v })}
              />
              <Knob
                label="天花板"
                value={effects.limiter.ceiling}
                min={-10}
                max={0}
                step={0.1}
                unit="dB"
                onChange={(v) => updateLimiter({ ceiling: v })}
              />
              <Knob
                label="启动"
                value={effects.limiter.attack}
                min={0.1}
                max={10}
                step={0.1}
                unit="ms"
                onChange={(v) => updateLimiter({ attack: v })}
              />
              <Knob
                label="释放"
                value={effects.limiter.release}
                min={10}
                max={500}
                step={10}
                unit="ms"
                onChange={(v) => updateLimiter({ release: v })}
              />
            </div>
            <p className="text-xs text-gray-500 mt-4">
              限制器可以防止音频削波，将输出峰值控制在阈值以下。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
