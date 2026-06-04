import React from 'react';
import { X, Camera, Cpu, Video, Globe, Hash } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Resolution, AccuracyLevel, RecordingFormat } from '@/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { config, setCameraConfig, setSegmentationConfig, setRecordingConfig, setJanusConfig } =
    useAppStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-xl font-bold text-white">设置</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          <div>
            <h3 className="text-sm font-semibold text-cyan-400 mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              摄像头设置
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  分辨率
                </label>
                <div className="flex gap-2">
                  {(['480p', '720p', '1080p'] as Resolution[]).map((res) => (
                    <button
                      key={res}
                      onClick={() => setCameraConfig({ resolution: res })}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                        config.camera.resolution === res
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  目标帧率: {config.camera.frameRate}fps
                </label>
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="5"
                  value={config.camera.frameRate}
                  onChange={(e) =>
                    setCameraConfig({
                      frameRate: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>15</span>
                  <span>60</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-purple-400 mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              分割设置
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  模型精度
                </label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as AccuracyLevel[]).map((acc) => (
                    <button
                      key={acc}
                      onClick={() =>
                        setSegmentationConfig({ accuracy: acc })
                      }
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                        config.segmentation.accuracy === acc
                          ? 'bg-purple-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {acc === 'low' ? '低 (int8)' : acc === 'medium' ? '中 (int8)' : '高 (int16)'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  低/中精度使用int8量化，高精度使用int16，兼顾性能与效果
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  分割帧间隔: 每{config.segmentation.frameSkip}帧分割一次
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={config.segmentation.frameSkip}
                  onChange={(e) =>
                    setSegmentationConfig({
                      frameSkip: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>每帧</span>
                  <span>每5帧</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  增大间隔可大幅提升低配设备帧率，掩码在间隔帧自动复用
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  边缘羽化半径: {config.segmentation.featherRadius}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={config.segmentation.featherRadius}
                  onChange={(e) =>
                    setSegmentationConfig({
                      featherRadius: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  边缘平滑度: {config.segmentation.edgeSmoothing}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={config.segmentation.edgeSmoothing}
                  onChange={(e) =>
                    setSegmentationConfig({
                      edgeSmoothing: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  时间平滑强度: {config.segmentation.temporalSmooth.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={config.segmentation.temporalSmooth}
                  onChange={(e) =>
                    setSegmentationConfig({
                      temporalSmooth: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  较低值减少闪烁但增加拖尾，较高值响应快但可能闪烁
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  前景阈值: {config.segmentation.foregroundThreshold.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={config.segmentation.foregroundThreshold}
                  onChange={(e) =>
                    setSegmentationConfig({
                      foregroundThreshold: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2">
              <Video className="w-4 h-4" />
              录制设置
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  录制格式
                </label>
                <div className="flex gap-2">
                  {(['webm', 'mp4'] as RecordingFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() =>
                        setRecordingConfig({ format: fmt })
                      }
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                        config.recording.format === fmt
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  MP4兼容性更好，WebM文件更小
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  视频码率: {Math.round(config.recording.bitrate / 1000)}kbps
                </label>
                <input
                  type="range"
                  min="1000000"
                  max="8000000"
                  step="500000"
                  value={config.recording.bitrate}
                  onChange={(e) =>
                    setRecordingConfig({
                      bitrate: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>1Mbps</span>
                  <span>8Mbps</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">录制音频</label>
                <button
                  onClick={() =>
                    setRecordingConfig({
                      includeAudio: !config.recording.includeAudio,
                    })
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                    config.recording.includeAudio
                      ? 'bg-emerald-500'
                      : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                      config.recording.includeAudio
                        ? 'translate-x-7'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-purple-400 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Janus 会议设置
            </h3>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                  <Globe className="w-4 h-4" />
                  服务器地址 (WebSocket)
                </label>
                <input
                  type="text"
                  value={config.janus.serverUrl}
                  onChange={(e) =>
                    setJanusConfig({ serverUrl: e.target.value })
                  }
                  placeholder="ws://localhost:8188"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                  <Hash className="w-4 h-4" />
                  默认房间号
                </label>
                <input
                  type="number"
                  value={config.janus.roomId}
                  onChange={(e) =>
                    setJanusConfig({ roomId: parseInt(e.target.value) })
                  }
                  placeholder="1234"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  显示名称
                </label>
                <input
                  type="text"
                  value={config.janus.displayName}
                  onChange={(e) =>
                    setJanusConfig({ displayName: e.target.value })
                  }
                  placeholder="你的名字"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>

              <p className="text-xs text-slate-500">
                Janus SFU 服务器支持多人视频会议，将处理后的视频流上传到服务器进行转发
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-700/50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
