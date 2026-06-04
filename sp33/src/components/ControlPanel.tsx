import { useState } from 'react';
import { ChevronLeft, ChevronRight, Box, Layers, Palette, Settings } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import { cn } from '../lib/utils.js';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-white/90">
          {icon}
          <span>{title}</span>
        </div>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-white/50 transition-transform',
            isOpen && 'rotate-90'
          )}
        />
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

export function ControlPanel() {
  const {
    models,
    materials,
    selectedModelId,
    maxBounces,
    enableAO,
    aoSamples,
    aoRadius,
    enableSoftShadows,
    shadowSamples,
    lightRadius,
    panelCollapsed,
    setSelectedModelId,
    setMaxBounces,
    setEnableAO,
    setAOSamples,
    setAORadius,
    setEnableSoftShadows,
    setShadowSamples,
    setLightRadius,
    setPanelCollapsed,
  } = useAppStore();

  if (panelCollapsed) {
    return (
      <button
        onClick={() => setPanelCollapsed(false)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-r-lg p-2 hover:bg-black/80 transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-white/70" />
      </button>
    );
  }

  return (
    <div className="absolute left-0 top-0 bottom-0 w-72 bg-black/60 backdrop-blur-xl border-r border-white/10 z-10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white tracking-tight">控制面板</h2>
        <button
          onClick={() => setPanelCollapsed(true)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white/70" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section title="模型选择" icon={<Box className="w-4 h-4 text-blue-400" />}>
          <div className="space-y-2">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModelId(model.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-all',
                  selectedModelId === model.id
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                )}
              >
                <div className="font-medium">{model.name}</div>
                <div className="text-xs opacity-60 mt-0.5">
                  {model.triangleCount.toLocaleString()} 三角形
                </div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="渲染参数" icon={<Settings className="w-4 h-4 text-purple-400" />}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/60 mb-2">
                最大反弹次数: {maxBounces}
              </label>
              <input
                type="range"
                min="1"
                max="16"
                value={maxBounces}
                onChange={(e) => setMaxBounces(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-white/40 mt-1">
                <span>1</span>
                <span>16</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMaxBounces(2)}
                className="px-3 py-1.5 text-xs bg-white/10 rounded hover:bg-white/20 transition-colors text-white/80"
              >
                快速
              </button>
              <button
                onClick={() => setMaxBounces(8)}
                className="px-3 py-1.5 text-xs bg-white/10 rounded hover:bg-white/20 transition-colors text-white/80"
              >
                平衡
              </button>
              <button
                onClick={() => setMaxBounces(12)}
                className="px-3 py-1.5 text-xs bg-white/10 rounded hover:bg-white/20 transition-colors text-white/80"
              >
                高质量
              </button>
              <button
                onClick={() => setMaxBounces(16)}
                className="px-3 py-1.5 text-xs bg-white/10 rounded hover:bg-white/20 transition-colors text-white/80"
              >
                电影级
              </button>
            </div>
          </div>
        </Section>

        <Section title="高级效果" icon={<Settings className="w-4 h-4 text-amber-400" />} defaultOpen={false}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/70">环境光遮蔽 (AO)</label>
              <button
                onClick={() => setEnableAO(!enableAO)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  enableAO ? 'bg-blue-500' : 'bg-white/20'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow',
                    enableAO ? 'left-5' : 'left-0.5'
                  )}
                />
              </button>
            </div>

            {enableAO && (
              <>
                <div>
                  <label className="block text-xs text-white/60 mb-2">
                    AO采样数: {aoSamples}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    value={aoSamples}
                    onChange={(e) => setAOSamples(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-2">
                    AO半径: {aoRadius.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={aoRadius}
                    onChange={(e) => setAORadius(parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </>
            )}

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-white/70">软阴影</label>
                <button
                  onClick={() => setEnableSoftShadows(!enableSoftShadows)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative',
                    enableSoftShadows ? 'bg-blue-500' : 'bg-white/20'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow',
                      enableSoftShadows ? 'left-5' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            </div>

            {enableSoftShadows && (
              <>
                <div>
                  <label className="block text-xs text-white/60 mb-2">
                    阴影采样数: {shadowSamples}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    value={shadowSamples}
                    onChange={(e) => setShadowSamples(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-2">
                    光源半径: {lightRadius.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={lightRadius}
                    onChange={(e) => setLightRadius(parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </Section>

        <Section title="材质预设" icon={<Palette className="w-4 h-4 text-pink-400" />}>
          <div className="space-y-2">
            {materials.map((mat) => (
              <div
                key={mat.id}
                className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-lg border border-white/10"
              >
                <div
                  className="w-6 h-6 rounded-full border border-white/20 shadow-inner"
                  style={{
                    backgroundColor: `rgb(${Math.min(255, mat.albedo[0] * 255)}, ${Math.min(255, mat.albedo[1] * 255)}, ${Math.min(255, mat.albedo[2] * 255)})`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/80 truncate">
                    {mat.name}
                  </div>
                  <div className="text-xs text-white/50 capitalize">
                    {mat.type === 'lambertian' ? '漫反射' : mat.type === 'metal' ? '金属' : '电介质'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="场景信息" icon={<Layers className="w-4 h-4 text-green-400" />} defaultOpen={false}>
          <div className="space-y-2 text-sm text-white/70">
            <p className="text-xs text-white/50">操作说明：</p>
            <ul className="space-y-1 text-xs text-white/60">
              <li>• 拖拽旋转视角</li>
              <li>• Shift+拖拽平移</li>
              <li>• 滚轮缩放</li>
              <li>• 调整参数后自动重渲</li>
            </ul>
          </div>
        </Section>
      </div>
    </div>
  );
}
