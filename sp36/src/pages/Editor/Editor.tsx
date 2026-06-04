import { useEffect, useState } from 'react'
import { Toolbar } from '@/components/Toolbar/Toolbar'
import { Timeline } from '@/components/Timeline/Timeline'
import { EffectsPanel } from '@/components/EffectsPanel/EffectsPanel'
import { PlaybackBar } from '@/components/PlaybackBar/PlaybackBar'
import { SpectrumAnalyzer } from '@/components/SpectrumAnalyzer/SpectrumAnalyzer'
import { BatchProcessor } from '@/components/BatchProcessor/BatchProcessor'
import { VstManager } from '@/components/VstManager/VstManager'
import { useAudioStore } from '@/store/useAudioStore'
import { BarChart3, Layers, Plug } from 'lucide-react'

type ViewMode = 'editor' | 'batch' | 'vst'

export function Editor() {
  const { initAudioEngine, tracks, getAudioContext, getMasterGain } = useAudioStore()
  const [viewMode, setViewMode] = useState<ViewMode>('editor')
  const [showSpectrum, setShowSpectrum] = useState(true)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [masterGain, setMasterGain] = useState<GainNode | null>(null)

  useEffect(() => {
    initAudioEngine()
    setAudioContext(getAudioContext())
    setMasterGain(getMasterGain())
  }, [initAudioEngine, getAudioContext, getMasterGain])

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      <Toolbar />

      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              viewMode === 'editor'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <BarChart3 size={14} />
            编辑器
          </button>
          <button
            onClick={() => setViewMode('batch')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              viewMode === 'batch'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Layers size={14} />
            批量处理
          </button>
          <button
            onClick={() => setViewMode('vst')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              viewMode === 'vst'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Plug size={14} />
            VST 插件
          </button>
        </div>

        {viewMode === 'editor' && (
          <button
            onClick={() => setShowSpectrum(!showSpectrum)}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              showSpectrum
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <BarChart3 size={14} />
            频谱分析
          </button>
        )}
      </div>

      {viewMode === 'editor' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <Timeline />
            <EffectsPanel />
          </div>

          {showSpectrum && tracks.length > 0 && (
            <div className="h-48 border-t border-gray-700 p-2">
              <SpectrumAnalyzer
                audioContext={audioContext}
                sourceNode={masterGain}
                width={800}
                height={160}
              />
            </div>
          )}

          <PlaybackBar />
        </div>
      )}

      {viewMode === 'batch' && <BatchProcessor />}

      {viewMode === 'vst' && (
        <div className="flex-1 p-4 overflow-auto">
          <div className="max-w-2xl mx-auto">
            <VstManager />
          </div>
        </div>
      )}
    </div>
  )
}
