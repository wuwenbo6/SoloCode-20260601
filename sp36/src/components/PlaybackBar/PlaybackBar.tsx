import { Play, Pause, SkipBack, Volume2, VolumeX } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import { formatTime } from '@/utils/audioUtils'

export function PlaybackBar() {
  const {
    isPlaying,
    togglePlay,
    currentTime,
    setCurrentTime,
    project,
    isMonitoring,
    toggleMonitoring,
  } = useAudioStore()

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    setCurrentTime(percentage * project.duration)
  }

  const handleSkipToStart = () => {
    setCurrentTime(0)
  }

  const progress = (currentTime / project.duration) * 100

  return (
    <div className="h-16 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-t border-gray-700 flex items-center px-6 gap-6">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSkipToStart}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          title="回到开始"
        >
          <SkipBack size={20} className="text-gray-300" />
        </button>

        <button
          onClick={togglePlay}
          className="p-3 bg-cyan-600 hover:bg-cyan-500 rounded-full transition-colors shadow-lg shadow-cyan-600/30"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? (
            <Pause size={24} className="text-white" />
          ) : (
            <Play size={24} className="text-white ml-0.5" />
          )}
        </button>

        <button
          onClick={toggleMonitoring}
          className={`p-2 rounded-lg transition-colors ${
            isMonitoring ? 'bg-cyan-600/20 text-cyan-400' : 'hover:bg-gray-700 text-gray-400'
          }`}
          title={isMonitoring ? '监听开启' : '监听关闭'}
        >
          {isMonitoring ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-2 bg-gray-700 rounded-full cursor-pointer relative overflow-hidden group"
          onClick={handleProgressClick}
        >
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 8px)` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(project.duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-gray-500">采样率</div>
          <div className="text-sm text-gray-300 font-mono">{project.sampleRate} Hz</div>
        </div>
      </div>
    </div>
  )
}
