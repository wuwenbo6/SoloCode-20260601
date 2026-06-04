import { Volume2, VolumeX, Music, Trash2, Headphones, Zap, RefreshCcw } from 'lucide-react'
import type { Track } from '@/types/audio'
import { useAudioStore } from '@/store/useAudioStore'

interface TrackControlProps {
  track: Track
  onSelectEffects: () => void
}

export function TrackControl({ track, onSelectEffects }: TrackControlProps) {
  const { updateTrack, removeTrack, selectTrack, selectedTrackId } = useAudioStore()

  const isSelected = selectedTrackId === track.id

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value)
    updateTrack(track.id, { volume })
  }

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pan = parseFloat(e.target.value)
    updateTrack(track.id, { pan })
  }

  const toggleMute = () => {
    updateTrack(track.id, { muted: !track.muted })
  }

  const toggleSolo = () => {
    updateTrack(track.id, { solo: !track.solo })
  }

  const togglePhaseInvert = () => {
    updateTrack(track.id, { phaseInvert: !track.phaseInvert })
  }

  return (
    <div
      className={`flex flex-col gap-2 p-3 border-r transition-colors cursor-pointer ${
        isSelected ? 'bg-indigo-900/30 border-indigo-500' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
      }`}
      style={{ width: 200, height: 100 }}
      onClick={() => selectTrack(track.id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: track.color }}
          />
          <Music size={14} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-white truncate">{track.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelectEffects()
            }}
            className="p-1 hover:bg-gray-600 rounded transition-colors"
            title="效果器"
          >
            <Zap size={14} className="text-yellow-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeTrack(track.id)
            }}
            className="p-1 hover:bg-red-600/50 rounded transition-colors"
            title="删除轨道"
          >
            <Trash2 size={14} className="text-red-400" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleMute()
          }}
          className={`p-1 rounded transition-colors ${
            track.muted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          title="静音"
        >
          {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleSolo()
          }}
          className={`p-1 rounded transition-colors ${
            track.solo ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          title="独奏"
        >
          <Headphones size={14} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            togglePhaseInvert()
          }}
          className={`p-1 rounded transition-colors ${
            track.phaseInvert ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          title="相位翻转"
        >
          <RefreshCcw size={14} />
        </button>

        <div className="flex-1 flex items-center gap-1">
          <span className="text-xs text-gray-500 w-4">V</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            onChange={handleVolumeChange}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 w-4">L</span>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={track.pan}
          onChange={handlePanChange}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-cyan-400"
        />
        <span className="text-xs text-gray-500 w-4">R</span>
      </div>
    </div>
  )
}
