import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PresetParams, ColorMode, Preset, ForceRecording, RecordingState, ViewMode } from '../types';
import { presetApi } from '../api/presetApi';
import { ParticleSystem } from '../particles/ParticleSystem';

interface ControlPanelProps {
  params: PresetParams;
  onParamsChange: (params: Partial<PresetParams>) => void;
  onReset: () => void;
  getParticleSystem: () => ParticleSystem | null;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step, onChange }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className="text-[11px] text-cyan-400 font-mono">{value.toFixed(step < 1 ? 3 : 1)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:w-3
        [&::-webkit-slider-thumb]:h-3
        [&::-webkit-slider-thumb]:rounded-full
        [&::-webkit-slider-thumb]:bg-cyan-400
        [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]
        [&::-webkit-slider-thumb]:cursor-pointer
        [&::-webkit-slider-thumb]:transition-shadow
        [&::-webkit-slider-thumb]:hover:shadow-[0_0_16px_rgba(0,240,255,0.8)]"
    />
  </div>
);

type TabType = 'forces' | 'boids' | 'particles' | 'recording' | 'export' | 'presets';

export const ControlPanel: React.FC<ControlPanelProps> = ({ params, onParamsChange, onReset, getParticleSystem }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('forces');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordings, setRecordings] = useState<ForceRecording[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [exportProgress, setExportProgress] = useState<string>('');
  const recordingTimerRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<number | null>(null);

  const loadPresets = useCallback(async () => {
    try {
      const data = await presetApi.getAllPresets();
      setPresets(data);
    } catch {
      setPresets([]);
    }
  }, []);

  const refreshRecordings = useCallback(() => {
    const ps = getParticleSystem();
    if (ps) {
      setRecordings(ps.getRecordings());
    }
  }, [getParticleSystem]);

  useEffect(() => {
    if (recordingState === 'recording') {
      recordingTimerRef.current = window.setInterval(() => {
        const ps = getParticleSystem();
        if (ps) {
          setRecordingDuration(ps.getRecordingDuration());
        }
      }, 100);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [recordingState, getParticleSystem]);

  useEffect(() => {
    if (recordingState === 'playing') {
      playbackTimerRef.current = window.setInterval(() => {
        const ps = getParticleSystem();
        if (ps) {
          setPlaybackProgress(ps.getPlaybackProgress());
        }
      }, 50);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      setPlaybackProgress(0);
    }
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [recordingState, getParticleSystem]);

  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim()) return;
    try {
      await presetApi.createPreset(presetName, params);
      setPresetName('');
      setSaveStatus('已保存');
      setTimeout(() => setSaveStatus(''), 2000);
      loadPresets();
    } catch {
      setSaveStatus('保存失败');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  }, [presetName, params, loadPresets]);

  const handleLoadPreset = useCallback((preset: Preset) => {
    onParamsChange(preset.params);
  }, [onParamsChange]);

  const handleDeletePreset = useCallback(async (id: string) => {
    try {
      await presetApi.deletePreset(id);
      loadPresets();
    } catch {}
  }, [loadPresets]);

  const handleStartRecording = useCallback(() => {
    const ps = getParticleSystem();
    if (ps) {
      ps.startRecording();
      setRecordingState('recording');
      setRecordingDuration(0);
    }
  }, [getParticleSystem]);

  const handleStopRecording = useCallback(() => {
    const ps = getParticleSystem();
    if (ps) {
      ps.stopRecording();
      setRecordingState('idle');
      refreshRecordings();
    }
  }, [getParticleSystem, refreshRecordings]);

  const handleStartPlayback = useCallback((recording: ForceRecording) => {
    const ps = getParticleSystem();
    if (ps) {
      ps.startPlayback(recording, true);
      setRecordingState('playing');
    }
  }, [getParticleSystem]);

  const handleStopPlayback = useCallback(() => {
    const ps = getParticleSystem();
    if (ps) {
      ps.stopPlayback();
      setRecordingState('idle');
    }
  }, [getParticleSystem]);

  const handleDeleteRecording = useCallback((id: string) => {
    const ps = getParticleSystem();
    if (ps) {
      ps.deleteRecording(id);
      refreshRecordings();
    }
  }, [getParticleSystem, refreshRecordings]);

  const handlePlaybackSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    const ps = getParticleSystem();
    if (ps) {
      ps.setPlaybackSpeed(speed);
    }
  }, [getParticleSystem]);

  const handleExportCSV = useCallback(async () => {
    const ps = getParticleSystem();
    if (!ps) return;
    setExportProgress('导出中...');
    try {
      await ps.downloadCSV();
      setExportProgress('导出完成');
      setTimeout(() => setExportProgress(''), 2000);
    } catch {
      setExportProgress('导出失败');
      setTimeout(() => setExportProgress(''), 2000);
    }
  }, [getParticleSystem]);

  const handleExportStats = useCallback(async () => {
    const ps = getParticleSystem();
    if (!ps) return;
    setExportProgress('计算统计中...');
    try {
      const stats = await ps.exportStatistics();
      const blob = new Blob([stats], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `particle_stats_${Date.now()}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      setExportProgress('导出完成');
      setTimeout(() => setExportProgress(''), 2000);
    } catch {
      setExportProgress('导出失败');
      setTimeout(() => setExportProgress(''), 2000);
    }
  }, [getParticleSystem]);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'forces', label: '力场' },
    { key: 'boids', label: '群聚' },
    { key: 'particles', label: '粒子' },
    { key: 'recording', label: '录制' },
    { key: 'export', label: '导出' },
    { key: 'presets', label: '预设' },
  ];

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out ${
        isOpen ? 'w-80' : 'w-10'
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -left-10 top-0 w-10 h-10 bg-black/60 backdrop-blur-md border border-cyan-500/30
          rounded-l-lg flex items-center justify-center text-cyan-400 hover:text-cyan-300
          hover:bg-black/80 transition-colors cursor-pointer"
      >
        {isOpen ? '▶' : '◀'}
      </button>

      {isOpen && (
        <div className="bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-2xl shadow-cyan-500/20 overflow-hidden">
          <div className="p-3 border-b border-cyan-500/20">
            <h2 className="text-sm font-bold text-cyan-400 tracking-wider">控制面板</h2>
          </div>

          <div className="flex flex-wrap border-b border-cyan-500/20">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'presets') loadPresets();
                  if (tab.key === 'recording') refreshRecordings();
                }}
                className={`flex-1 py-1.5 text-xs transition-colors cursor-pointer min-w-[48px] ${
                  activeTab === tab.key
                    ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-3 max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {activeTab === 'forces' && (
              <>
                <div className="text-[10px] text-violet-400 font-bold uppercase tracking-widest mb-1">中心引力</div>
                <Slider
                  label="引力强度"
                  value={params.gravityStrength}
                  min={0} max={200} step={1}
                  onChange={(v) => onParamsChange({ gravityStrength: v })}
                />
                <Slider
                  label="引力半径"
                  value={params.gravityRadius}
                  min={50} max={800} step={10}
                  onChange={(v) => onParamsChange({ gravityRadius: v })}
                />

                <div className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mb-1 mt-3">中心斥力</div>
                <Slider
                  label="斥力强度"
                  value={params.repulsionStrength}
                  min={0} max={200} step={1}
                  onChange={(v) => onParamsChange({ repulsionStrength: v })}
                />
                <Slider
                  label="斥力半径"
                  value={params.repulsionRadius}
                  min={10} max={400} step={5}
                  onChange={(v) => onParamsChange({ repulsionRadius: v })}
                />

                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1 mt-3">涡流力场</div>
                <Slider
                  label="涡流强度"
                  value={params.vortexStrength}
                  min={0} max={100} step={1}
                  onChange={(v) => onParamsChange({ vortexStrength: v })}
                />
                <Slider
                  label="涡流半径"
                  value={params.vortexRadius}
                  min={50} max={600} step={10}
                  onChange={(v) => onParamsChange({ vortexRadius: v })}
                />

                <div className="text-[10px] text-pink-400 font-bold uppercase tracking-widest mb-1 mt-3">鼠标斥力</div>
                <Slider
                  label="鼠标斥力强度"
                  value={params.mouseStrength}
                  min={0} max={2000} step={10}
                  onChange={(v) => onParamsChange({ mouseStrength: v })}
                />
                <Slider
                  label="鼠标斥力半径"
                  value={params.mouseRadius}
                  min={20} max={400} step={5}
                  onChange={(v) => onParamsChange({ mouseRadius: v })}
                />

                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1 mt-3">物理</div>
                <Slider
                  label="阻尼"
                  value={params.damping}
                  min={0.9} max={1.0} step={0.001}
                  onChange={(v) => onParamsChange({ damping: v })}
                />
                <Slider
                  label="反弹阻尼"
                  value={params.bounceDamping}
                  min={0.1} max={1.0} step={0.01}
                  onChange={(v) => onParamsChange({ bounceDamping: v })}
                />
              </>
            )}

            {activeTab === 'boids' && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-cyan-400">启用 Boids 算法</span>
                  <button
                    onClick={() => onParamsChange({ boidsEnabled: !params.boidsEnabled })}
                    className={`w-12 h-6 rounded-full transition-all cursor-pointer ${
                      params.boidsEnabled ? 'bg-cyan-500/30 border-cyan-500/50' : 'bg-zinc-700/50 border-zinc-600/50'
                    } border relative`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                        params.boidsEnabled ? 'left-6 bg-cyan-400' : 'left-1 bg-zinc-500'
                      }`}
                    />
                  </button>
                </div>

                <div className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1">分离 Separation</div>
                <Slider
                  label="分离强度"
                  value={params.separationStrength}
                  min={0} max={5} step={0.1}
                  onChange={(v) => onParamsChange({ separationStrength: v })}
                />
                <Slider
                  label="分离半径"
                  value={params.separationRadius}
                  min={5} max={50} step={1}
                  onChange={(v) => onParamsChange({ separationRadius: v })}
                />

                <div className="text-[10px] text-green-400 font-bold uppercase tracking-widest mb-1 mt-3">对齐 Alignment</div>
                <Slider
                  label="对齐强度"
                  value={params.alignmentStrength}
                  min={0} max={3} step={0.1}
                  onChange={(v) => onParamsChange({ alignmentStrength: v })}
                />
                <Slider
                  label="对齐半径"
                  value={params.alignmentRadius}
                  min={10} max={80} step={1}
                  onChange={(v) => onParamsChange({ alignmentRadius: v })}
                />

                <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1 mt-3">凝聚 Cohesion</div>
                <Slider
                  label="凝聚强度"
                  value={params.cohesionStrength}
                  min={0} max={2} step={0.1}
                  onChange={(v) => onParamsChange({ cohesionStrength: v })}
                />
                <Slider
                  label="凝聚半径"
                  value={params.cohesionRadius}
                  min={20} max={100} step={1}
                  onChange={(v) => onParamsChange({ cohesionRadius: v })}
                />

                <div className="text-[9px] text-zinc-500 mt-2 leading-relaxed">
                  分离：避免碰撞 | 对齐：统一方向 | 凝聚：向中心聚集
                </div>
              </>
            )}

            {activeTab === 'particles' && (
              <>
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1">粒子参数</div>
                <Slider
                  label="粒子数量"
                  value={params.particleCount}
                  min={1000} max={1000000} step={10000}
                  onChange={(v) => onParamsChange({ particleCount: v })}
                />
                <Slider
                  label="粒子大小"
                  value={params.particleSize}
                  min={0.3} max={6} step={0.1}
                  onChange={(v) => onParamsChange({ particleSize: v })}
                />
                <Slider
                  label="LOD 级别"
                  value={params.lodBias}
                  min={0} max={2} step={1}
                  onChange={(v) => onParamsChange({ lodBias: v })}
                />
                <div className="text-[9px] text-zinc-500 mt-[-6px]">
                  {params.lodBias === 0 ? '自动LOD (性能优先)' : params.lodBias === 1 ? '质量模式 (渲染50%)' : '强制全量渲染'}
                </div>

                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1 mt-3">颜色模式</div>
                <div className="grid grid-cols-5 gap-1">
                  {(['velocity', 'position', 'rainbow', 'fixed', 'boids'] as ColorMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onParamsChange({ colorMode: mode })}
                      className={`text-[9px] py-1 px-1 rounded transition-all cursor-pointer ${
                        params.colorMode === mode
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                          : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:text-zinc-300'
                      }`}
                    >
                      {mode === 'velocity' ? '速度' : mode === 'position' ? '位置' : mode === 'rainbow' ? '彩虹' : mode === 'fixed' ? '固定' : '群聚'}
                    </button>
                  ))}
                </div>

                {params.colorMode === 'fixed' && (
                  <div className="mt-2 space-y-2">
                    <Slider
                      label="R"
                      value={params.baseColor[0]}
                      min={0} max={1} step={0.01}
                      onChange={(v) => onParamsChange({ baseColor: [v, params.baseColor[1], params.baseColor[2]] })}
                    />
                    <Slider
                      label="G"
                      value={params.baseColor[1]}
                      min={0} max={1} step={0.01}
                      onChange={(v) => onParamsChange({ baseColor: [params.baseColor[0], v, params.baseColor[2]] })}
                    />
                    <Slider
                      label="B"
                      value={params.baseColor[2]}
                      min={0} max={1} step={0.01}
                      onChange={(v) => onParamsChange({ baseColor: [params.baseColor[0], params.baseColor[1], v] })}
                    />
                  </div>
                )}

                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1 mt-3">视图模式</div>
                <div className="grid grid-cols-4 gap-1">
                  {(['top', 'side', 'perspective', 'split'] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onParamsChange({ viewMode: mode })}
                      className={`text-[9px] py-1.5 px-1 rounded transition-all cursor-pointer ${
                        params.viewMode === mode
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50'
                          : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:text-zinc-300'
                      }`}
                    >
                      {mode === 'top' ? '俯视' : mode === 'side' ? '侧视' : mode === 'perspective' ? '透视' : '分屏'}
                    </button>
                  ))}
                </div>

                {params.viewMode !== 'top' && (
                  <div className="mt-2">
                    <Slider
                      label="视角角度"
                      value={params.viewAngle}
                      min={-45} max={45} step={1}
                      onChange={(v) => onParamsChange({ viewAngle: v })}
                    />
                    <Slider
                      label="缩放"
                      value={params.viewZoom}
                      min={0.5} max={2} step={0.1}
                      onChange={(v) => onParamsChange({ viewZoom: v })}
                    />
                  </div>
                )}

                <button
                  onClick={onReset}
                  className="w-full mt-3 py-2 text-[11px] text-orange-400 border border-orange-500/30 rounded
                    hover:bg-orange-500/10 transition-colors cursor-pointer"
                >
                  重置粒子
                </button>
              </>
            )}

            {activeTab === 'recording' && (
              <>
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-2">力场录制</div>

                <div className="flex gap-2 mb-3">
                  {recordingState === 'idle' && (
                    <button
                      onClick={handleStartRecording}
                      className="flex-1 py-2 text-[11px] text-red-400 border border-red-500/30 rounded
                        hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      开始录制
                    </button>
                  )}
                  {recordingState === 'recording' && (
                    <button
                      onClick={handleStopRecording}
                      className="flex-1 py-2 text-[11px] text-zinc-300 bg-red-500/20 border border-red-500/30 rounded
                        hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      停止录制 ({(recordingDuration / 1000).toFixed(1)}s)
                    </button>
                  )}
                  {recordingState === 'playing' && (
                    <button
                      onClick={handleStopPlayback}
                      className="flex-1 py-2 text-[11px] text-zinc-300 bg-amber-500/20 border border-amber-500/30 rounded
                        hover:bg-amber-500/30 transition-colors cursor-pointer"
                    >
                      停止回放
                    </button>
                  )}
                </div>

                <div className="text-[10px] text-zinc-500 mb-1">
                  录制时移动鼠标，轨迹将保存为力场路径
                </div>

                {recordings.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase">已录制</div>
                    {recordings.map((rec) => (
                      <div
                        key={rec.id}
                        className="bg-zinc-800/40 border border-zinc-700/30 rounded p-2"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] text-zinc-300 truncate">{rec.name}</span>
                          <span className="text-[9px] text-zinc-500">{(rec.duration / 1000).toFixed(1)}s</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleStartPlayback(rec)}
                            disabled={recordingState === 'recording'}
                            className="flex-1 py-1 text-[10px] text-emerald-400 border border-emerald-500/30 rounded
                              hover:bg-emerald-500/10 transition-colors disabled:opacity-30 cursor-pointer"
                          >
                            回放
                          </button>
                          <button
                            onClick={() => handleDeleteRecording(rec.id)}
                            className="px-2 py-1 text-[10px] text-zinc-500 border border-zinc-700/30 rounded
                              hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <Slider
                    label="回放速度"
                    value={playbackSpeed}
                    min={0.25} max={3} step={0.25}
                    onChange={handlePlaybackSpeedChange}
                  />
                </div>
              </>
            )}

            {activeTab === 'export' && (
              <>
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-2">数据导出</div>

                <div className="bg-zinc-800/30 border border-zinc-700/30 rounded p-3 mb-3">
                  <div className="text-[11px] text-zinc-300 mb-2">CSV 粒子数据</div>
                  <div className="text-[9px] text-zinc-500 mb-2 leading-relaxed">
                    导出所有粒子的位置、速度、颜色数据，用于科学分析
                  </div>
                  <button
                    onClick={handleExportCSV}
                    className="w-full py-2 text-[11px] text-cyan-400 border border-cyan-500/30 rounded
                      hover:bg-cyan-500/10 transition-colors cursor-pointer"
                  >
                    导出 CSV
                  </button>
                </div>

                <div className="bg-zinc-800/30 border border-zinc-700/30 rounded p-3">
                  <div className="text-[11px] text-zinc-300 mb-2">统计分析报告</div>
                  <div className="text-[9px] text-zinc-500 mb-2 leading-relaxed">
                    包括速度统计、位置中心、动能等分析数据
                  </div>
                  <button
                    onClick={handleExportStats}
                    className="w-full py-2 text-[11px] text-violet-400 border border-violet-500/30 rounded
                      hover:bg-violet-500/10 transition-colors cursor-pointer"
                  >
                    导出统计报告
                  </button>
                </div>

                {exportProgress && (
                  <div className="text-center text-[11px] text-cyan-400 mt-2">{exportProgress}</div>
                )}
              </>
            )}

            {activeTab === 'presets' && (
              <>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="预设名称..."
                    className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1.5 text-xs text-white
                      placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    onClick={handleSavePreset}
                    disabled={!presetName.trim()}
                    className="px-3 py-1.5 text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded
                      hover:bg-cyan-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    保存
                  </button>
                </div>
                {saveStatus && (
                  <div className="text-[10px] text-center text-cyan-400">{saveStatus}</div>
                )}

                <div className="space-y-1 mt-2">
                  {presets.length === 0 && (
                    <div className="text-[10px] text-zinc-600 text-center py-4">暂无预设</div>
                  )}
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between bg-zinc-800/40 border border-zinc-700/30 rounded px-2 py-1.5 group"
                    >
                      <button
                        onClick={() => handleLoadPreset(preset)}
                        className="text-[11px] text-zinc-300 hover:text-cyan-400 transition-colors truncate flex-1 text-left cursor-pointer"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors ml-2 opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
