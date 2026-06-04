import { Settings, Monitor, Gauge, Zap, Film, FileImage } from 'lucide-react';
import type { TranscodeParams, Resolution, Quality, OutputFormat } from '../../shared/types.js';

interface ParamsPanelProps {
  params: TranscodeParams;
  onChange: (params: TranscodeParams) => void;
  disabled?: boolean;
}

const resolutionOptions: { value: Resolution; label: string; desc: string }[] = [
  { value: 'original', label: '原尺寸', desc: '保持原始分辨率' },
  { value: '720p', label: '720p', desc: '1280 × 720' },
  { value: '480p', label: '480p', desc: '854 × 480' },
];

const qualityOptions: { value: Quality; label: string; desc: string }[] = [
  { value: 'high', label: '高质量', desc: '文件较大，画质更好' },
  { value: 'low', label: '低质量', desc: '文件较小，转码更快' },
];

const formatOptions: { value: OutputFormat; label: string; desc: string; icon: any }[] = [
  { value: 'mp4', label: 'MP4', desc: '视频格式，通用兼容', icon: Film },
  { value: 'gif', label: 'GIF', desc: '动图格式，无声音', icon: FileImage },
  { value: 'webp', label: 'WebP', desc: '高效动图，文件更小', icon: FileImage },
];

export const ParamsPanel = ({ params, onChange, disabled }: ParamsPanelProps) => {
  const handleFpsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...params, fps: parseInt(e.target.value) });
  };

  const handleResolutionChange = (resolution: Resolution) => {
    onChange({ ...params, resolution });
  };

  const handleQualityChange = (quality: Quality) => {
    onChange({ ...params, quality });
  };

  const handleFormatChange = (format: OutputFormat) => {
    onChange({ ...params, format });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Settings className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-100">转码参数</h3>
          <p className="text-sm text-slate-400">自定义输出视频设置</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Film className="w-4 h-4 text-cyan-400" />
            <label className="text-sm font-medium text-slate-300">输出格式</label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {formatOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleFormatChange(option.value)}
                disabled={disabled}
                className={`p-3 rounded-lg border-2 transition-all duration-200 text-center
                  ${params.format === option.value
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option.icon className="w-5 h-5 mx-auto mb-1" />
                <div className="font-medium text-sm">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <label className="text-sm font-medium text-slate-300">帧率 (FPS)</label>
            </div>
            <span className="text-2xl font-bold text-cyan-400 font-mono">
              {params.fps}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={params.fps}
            onChange={handleFpsChange}
            disabled={disabled}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-cyan-400
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:shadow-cyan-500/50
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:scale-110
              disabled:opacity-50
              disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1 fps</span>
            <span>30 fps</span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <label className="text-sm font-medium text-slate-300">分辨率</label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {resolutionOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleResolutionChange(option.value)}
                disabled={disabled}
                className={`p-3 rounded-lg border-2 transition-all duration-200 text-left
                  ${params.resolution === option.value
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs opacity-70">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-cyan-400" />
            <label className="text-sm font-medium text-slate-300">质量</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {qualityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleQualityChange(option.value)}
                disabled={disabled}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left
                  ${params.quality === option.value
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs opacity-70">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
