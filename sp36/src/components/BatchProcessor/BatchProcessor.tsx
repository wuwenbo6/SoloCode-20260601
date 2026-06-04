import { useState, useCallback, useRef } from 'react'
import {
  Upload,
  Play,
  Pause,
  Square,
  Download,
  Settings,
  Trash2,
  Check,
  X,
  Loader2,
  Music,
  FolderOpen,
} from 'lucide-react'
import type { BatchJob, BatchConfig, EffectChain } from '@/types/audio'
import { DEFAULT_BATCH_CONFIG, createDefaultEffectChain } from '@/types/audio'
import { decodeAudioFile } from '@/audio/decoder'
import { mixTracksSampleAccurate, audioBufferToWAV } from '@/utils/audioUtils'
import { EffectsPanel } from '@/components/EffectsPanel/EffectsPanel'

export function BatchProcessor() {
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [config, setConfig] = useState<BatchConfig>({ ...DEFAULT_BATCH_CONFIG })
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState(0)
  const [showEffectConfig, setShowEffectConfig] = useState(false)
  const [effectChain, setEffectChain] = useState<EffectChain>(createDefaultEffectChain())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const newJobs: BatchJob[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      file,
      status: 'pending' as const,
      progress: 0,
      effectChain: { ...effectChain },
      outputFormat: config.outputFormat,
    }))

    setJobs((prev) => [...prev, ...newJobs])
  }, [config.outputFormat, effectChain])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const removeJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [])

  const clearJobs = useCallback(() => {
    setJobs([])
    setCurrentJobIndex(0)
    setIsProcessing(false)
    setIsPaused(false)
  }, [])

  const processJob = useCallback(async (job: BatchJob, sampleRate: number = 44100): Promise<Blob> => {
    if (!job.file) {
      throw new Error('No file selected')
    }

    const result = await decodeAudioFile(job.file)
    const audioBuffer = result.audioBuffer

    const trackConfig = {
      audioBuffer,
      startTime: 0,
      trimStart: 0,
      trimEnd: 0,
      volume: 1,
      phaseInvert: false,
      muted: false,
    }

    const processedBuffer = await mixTracksSampleAccurate(
      [trackConfig],
      sampleRate,
      audioBuffer.duration
    )

    const wav = audioBufferToWAV(processedBuffer)
    return new Blob([wav], { type: 'audio/wav' })
  }, [])

  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.replace(/\.[^/.]+$/, '') + '_processed.wav'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const startProcessing = useCallback(async () => {
    if (isProcessing && !isPaused) return

    setIsProcessing(true)
    setIsPaused(false)

    for (let i = currentJobIndex; i < jobs.length; i++) {
      if (!isProcessing || isPaused) break

      const job = jobs[i]
      if (job.status === 'completed') continue

      setCurrentJobIndex(i)
      setJobs((prev) =>
        prev.map((j, idx) =>
          idx === i ? { ...j, status: 'processing' as const, progress: 0 } : j
        )
      )

      try {
        const blob = await processJob(job)

        setJobs((prev) =>
          prev.map((j, idx) =>
            idx === i ? { ...j, status: 'completed' as const, progress: 100 } : j
          )
        )

        downloadBlob(blob, job.fileName)

        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error('Error processing job:', error)
        setJobs((prev) =>
          prev.map((j, idx) =>
            idx === i
              ? { ...j, status: 'error' as const, error: (error as Error).message }
              : j
          )
        )
      }
    }

    setIsProcessing(false)
  }, [isProcessing, isPaused, jobs, currentJobIndex, processJob, downloadBlob])

  const pauseProcessing = useCallback(() => {
    setIsPaused(true)
  }, [])

  const stopProcessing = useCallback(() => {
    setIsProcessing(false)
    setIsPaused(false)
    setCurrentJobIndex(0)
  }, [])

  const updateConfig = useCallback((updates: Partial<BatchConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
  }, [])

  const completedCount = jobs.filter((j) => j.status === 'completed').length
  const errorCount = jobs.filter((j) => j.status === 'error').length
  const pendingCount = jobs.filter((j) => j.status === 'pending').length

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-white font-semibold text-lg">批量处理模式</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEffectConfig(!showEffectConfig)}
            className={`p-2 rounded transition-colors ${
              showEffectConfig
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="效果器配置"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={clearJobs}
            className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="清空列表"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div
            className="flex-1 border-2 border-dashed border-gray-600 rounded-lg p-4 flex flex-col items-center justify-center mb-4 hover:border-cyan-500 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="text-gray-500 mb-4" size={48} />
            <p className="text-gray-400 text-center mb-2">
              拖拽音频文件到此处或点击选择
            </p>
            <p className="text-gray-500 text-sm text-center">
              支持 MP3、WAV、FLAC、AAC 格式
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">输出格式:</span>
              <select
                value={config.outputFormat}
                onChange={(e) => updateConfig({ outputFormat: e.target.value as any })}
                className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm"
              >
                <option value="wav">WAV (无损)</option>
                <option value="mp3">MP3 (有损)</option>
                <option value="flac">FLAC (无损压缩)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.overwriteExisting}
                onChange={(e) => updateConfig({ overwriteExisting: e.target.checked })}
                className="rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-gray-400 text-sm">覆盖现有文件</span>
            </label>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={startProcessing}
              disabled={jobs.length === 0 || (isProcessing && !isPaused)}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors font-medium"
            >
              {isProcessing && !isPaused ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  处理中...
                </>
              ) : isPaused ? (
                <>
                  <Play size={18} />
                  继续处理
                </>
              ) : (
                <>
                  <Play size={18} />
                  开始批量处理
                </>
              )}
            </button>
            {isProcessing && (
              <button
                onClick={pauseProcessing}
                className="flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-4 rounded-lg transition-colors"
              >
                <Pause size={18} />
              </button>
            )}
            {(isProcessing || isPaused) && (
              <button
                onClick={stopProcessing}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg transition-colors"
              >
                <Square size={18} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{jobs.length}</div>
              <div className="text-xs text-gray-400">总文件</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{completedCount}</div>
              <div className="text-xs text-gray-400">已完成</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
              <div className="text-xs text-gray-400">待处理</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{errorCount}</div>
              <div className="text-xs text-gray-400">错误</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-800 rounded-lg">
            {jobs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Music size={48} className="mx-auto mb-2 opacity-50" />
                  <p>添加音频文件开始批量处理</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {jobs.map((job, index) => (
                  <div
                    key={job.id}
                    className={`p-3 flex items-center gap-3 ${
                      index === currentJobIndex && isProcessing
                        ? 'bg-cyan-900/30'
                        : ''
                    }`}
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 text-gray-300 text-sm">
                      {job.status === 'completed' ? (
                        <Check size={16} className="text-green-400" />
                      ) : job.status === 'error' ? (
                        <X size={16} className="text-red-400" />
                      ) : job.status === 'processing' ? (
                        <Loader2 size={16} className="animate-spin text-cyan-400" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm truncate">{job.fileName}</div>
                      {job.status === 'processing' && (
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-cyan-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}
                      {job.status === 'error' && job.error && (
                        <div className="text-red-400 text-xs mt-1">{job.error}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 w-16 text-right">
                      {job.status === 'completed' && '完成'}
                      {job.status === 'pending' && '等待中'}
                      {job.status === 'processing' && `${job.progress}%`}
                      {job.status === 'error' && '错误'}
                    </div>
                    {job.status === 'completed' && (
                      <button
                        onClick={() => {
                          const blob = new Blob([], { type: 'audio/wav' })
                          downloadBlob(blob, job.fileName)
                        }}
                        className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                      >
                        <Download size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => removeJob(job.id)}
                      className="p-1.5 rounded bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showEffectConfig && (
          <div className="w-80 border-l border-gray-700 bg-gray-800 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-white font-medium mb-4">效果器配置</h3>
              <p className="text-gray-400 text-sm mb-4">
                配置将应用于所有批量处理文件的效果器链
              </p>
              <EffectsPanel
                effects={effectChain}
                onUpdateCompressor={(params) =>
                  setEffectChain((prev) => ({
                    ...prev,
                    compressor: { ...prev.compressor, ...params },
                  }))
                }
                onUpdateEqualizer={(params) =>
                  setEffectChain((prev) => ({
                    ...prev,
                    equalizer: { ...prev.equalizer, ...params },
                  }))
                }
                onUpdateLimiter={(params) =>
                  setEffectChain((prev) => ({
                    ...prev,
                    limiter: { ...prev.limiter, ...params },
                  }))
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
