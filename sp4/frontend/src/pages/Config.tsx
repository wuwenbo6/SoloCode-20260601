import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { useStore } from '../store';
import { systemApi, closApi, simulatorApi } from '../services/api';
import type { SystemConfig, CLOSGroup } from '../types';
import Header from '../components/Header';

export default function Config() {
  const systemConfig = useStore((s) => s.systemConfig);
  const closGroups = useStore((s) => s.closGroups);
  const simulatorStatus = useStore((s) => s.simulatorStatus);
  const setSystemConfig = useStore((s) => s.setSystemConfig);
  const setCLOSGroups = useStore((s) => s.setCLOSGroups);
  const setSimulatorStatus = useStore((s) => s.setSimulatorStatus);

  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [clos, setClos] = useState<CLOSGroup[]>([]);
  const [showAddCLOS, setShowAddCLOS] = useState(false);
  const [newCLOS, setNewCLOS] = useState({
    name: '',
    cbm: 0xFFFFF,
    bw_mbps: 0,
    color: '#00E5FF',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cfg, c, status] = await Promise.all([
          systemApi.getConfig(),
          closApi.getAll(),
          simulatorApi.getStatus(),
        ]);
        setConfig(cfg);
        setClos(c);
        setSystemConfig(cfg);
        setCLOSGroups(c);
        setSimulatorStatus(status);
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    };
    loadData();
  }, [setSystemConfig, setCLOSGroups, setSimulatorStatus]);

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      const updated = await systemApi.updateConfig(config);
      setConfig(updated);
      setSystemConfig(updated);
    } catch (e) {
      console.error('Failed to update config:', e);
    }
  };

  const handleAddCLOS = async () => {
    try {
      const created = await closApi.create(newCLOS);
      const updated = await closApi.getAll();
      setClos(updated);
      setCLOSGroups(updated);
      setShowAddCLOS(false);
      setNewCLOS({ name: '', cbm: 0xFFFFF, bw_mbps: 0, color: '#00E5FF' });
    } catch (e) {
      console.error('Failed to create CLOS:', e);
    }
  };

  const handleDeleteCLOS = async (id: number) => {
    if (id === 0) {
      alert('无法删除默认CLOS组');
      return;
    }
    if (confirm('确定要删除此CLOS组吗？所有关联进程将移至默认组。')) {
      try {
        await closApi.remove(id);
        const updated = await closApi.getAll();
        setClos(updated);
        setCLOSGroups(updated);
      } catch (e) {
        console.error('Failed to delete CLOS:', e);
      }
    }
  };

  const handleUpdateCLOS = async (id: number, updates: Partial<CLOSGroup>) => {
    try {
      await closApi.update(id, updates);
      const updated = await closApi.getAll();
      setClos(updated);
      setCLOSGroups(updated);
    } catch (e) {
      console.error('Failed to update CLOS:', e);
    }
  };

  const handleToggleSimulator = async () => {
    try {
      if (simulatorStatus?.running) {
        await simulatorApi.stop();
      } else {
        await simulatorApi.start();
      }
      const status = await simulatorApi.getStatus();
      setSimulatorStatus(status);
    } catch (e) {
      console.error('Failed to toggle simulator:', e);
    }
  };

  const colors = ['#00E5FF', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#2196F3', '#FFEB3B', '#E91E63'];

  return (
    <div className="min-h-screen bg-[#0A1929]">
      <Header
        title="资源配置"
        subtitle="配置全局资源参数和CLOS分配策略"
      />

      <main className="p-8 space-y-8 max-w-5xl mx-auto">
        <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-6 h-6 text-[#00E5FF]" />
              <h3 className="text-lg font-semibold text-white">模拟参数配置</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${simulatorStatus?.running ? 'text-[#4CAF50]' : 'text-[#F44336]'}`}>
                模拟器: {simulatorStatus?.running ? '运行中' : '已停止'}
              </span>
              <button
                onClick={handleToggleSimulator}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  simulatorStatus?.running
                    ? 'bg-[#F44336]/10 text-[#F44336] hover:bg-[#F44336]/20'
                    : 'bg-[#4CAF50]/10 text-[#4CAF50] hover:bg-[#4CAF50]/20'
                }`}
              >
                {simulatorStatus?.running ? '停止模拟' : '启动模拟'}
              </button>
            </div>
          </div>

          {config && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm text-[#B2BAC2] mb-2">LLC总容量</label>
                <input
                  type="number"
                  value={config.total_llc_capacity}
                  onChange={(e) => setConfig({ ...config, total_llc_capacity: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF] font-mono"
                />
                <p className="text-xs text-[#8892B0] mt-1">Last Level Cache 总容量（单位）</p>
              </div>
              <div>
                <label className="block text-sm text-[#B2BAC2] mb-2">内存总带宽 (MB/s)</label>
                <input
                  type="number"
                  value={config.total_bw_capacity}
                  onChange={(e) => setConfig({ ...config, total_bw_capacity: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF] font-mono"
                />
                <p className="text-xs text-[#8892B0] mt-1">系统内存带宽上限</p>
              </div>
              <div>
                <label className="block text-sm text-[#B2BAC2] mb-2">更新间隔 (ms)</label>
                <input
                  type="number"
                  value={config.update_interval_ms}
                  onChange={(e) => setConfig({ ...config, update_interval_ms: parseInt(e.target.value) })}
                  min="100"
                  step="100"
                  className="w-full px-4 py-3 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF] font-mono"
                />
                <p className="text-xs text-[#8892B0] mt-1">数据生成和推送频率</p>
              </div>
              <div>
                <label className="block text-sm text-[#B2BAC2] mb-2">噪声系数</label>
                <input
                  type="number"
                  value={config.noise_coefficient}
                  onChange={(e) => setConfig({ ...config, noise_coefficient: parseFloat(e.target.value) })}
                  min="0"
                  max="1"
                  step="0.01"
                  className="w-full px-4 py-3 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF] font-mono"
                />
                <p className="text-xs text-[#8892B0] mt-1">数据随机波动幅度 (0-1)</p>
              </div>
              <div>
                <label className="block text-sm text-[#B2BAC2] mb-2">命中率下限</label>
                <input
                  type="number"
                  value={config.hit_rate_min}
                  onChange={(e) => setConfig({ ...config, hit_rate_min: parseFloat(e.target.value) })}
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full px-4 py-3 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF] font-mono"
                />
                <p className="text-xs text-[#8892B0] mt-1">LLC命中率最小值</p>
              </div>
              <div>
                <label className="block text-sm text-[#B2BAC2] mb-2">命中率上限</label>
                <input
                  type="number"
                  value={config.hit_rate_max}
                  onChange={(e) => setConfig({ ...config, hit_rate_max: parseFloat(e.target.value) })}
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full px-4 py-3 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF] font-mono"
                />
                <p className="text-xs text-[#8892B0] mt-1">LLC命中率最大值</p>
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-[#1e3a5f] flex justify-end">
            <button
              onClick={handleSaveConfig}
              className="flex items-center gap-2 px-6 py-2 bg-[#00E5FF] text-[#0A1929] rounded-lg font-medium hover:bg-[#00E5FF]/90 transition-colors"
            >
              <Save className="w-4 h-4" />
              保存配置
            </button>
          </div>
        </div>

        <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">CLOS 资源分配组</h3>
            <button
              onClick={() => setShowAddCLOS(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00E5FF]/10 text-[#00E5FF] rounded-lg font-medium hover:bg-[#00E5FF]/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加CLOS组
            </button>
          </div>

          <div className="space-y-4">
            {clos.map((group) => (
              <div
                key={group.id}
                className="bg-[#0A1929] rounded-lg p-4 border border-[#1e3a5f] hover:border-[#00E5FF]/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: group.color }}
                    />
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => handleUpdateCLOS(group.id, { name: e.target.value })}
                      className="bg-transparent text-white font-medium text-lg focus:outline-none focus:border-b border-[#00E5FF]"
                    />
                    <span className="text-xs text-[#B2BAC2] bg-[#132F4C] px-2 py-1 rounded-full font-mono">
                      ID: {group.id}
                    </span>
                    {group.id === 0 && (
                      <span className="text-xs text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-1 rounded-full">
                        默认组
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {colors.map((c) => (
                        <button
                          key={c}
                          onClick={() => handleUpdateCLOS(group.id, { color: c })}
                          className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                            group.color === c ? 'border-white scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => handleDeleteCLOS(group.id)}
                      disabled={group.id === 0}
                      className="p-2 rounded-lg hover:bg-[#F44336]/10 text-[#B2BAC2] hover:text-[#F44336] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-[#B2BAC2] mb-2">CBM (Capacity Bitmask)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={`0x${group.cbm.toString(16).toUpperCase()}`}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 16);
                          if (!isNaN(val)) handleUpdateCLOS(group.id, { cbm: val });
                        }}
                        className="flex-1 px-4 py-2 bg-[#132F4C] border border-[#1e3a5f] rounded-lg text-white font-mono focus:outline-none focus:border-[#00E5FF]"
                      />
                      <div className="flex gap-1">
                        {Array.from({ length: 20 }, (_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-6 rounded-sm ${
                              (group.cbm >> (19 - i)) & 1 ? 'opacity-100' : 'opacity-20'
                            }`}
                            style={{ backgroundColor: group.color }}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-[#8892B0] mt-1">
                      已分配 {group.cbm.toString(2).split('1').length - 1} / 20 个缓存路
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-[#B2BAC2] mb-2">带宽限制 (MB/s)</label>
                    <input
                      type="number"
                      value={group.bw_mbps}
                      onChange={(e) => handleUpdateCLOS(group.id, { bw_mbps: parseInt(e.target.value) || 0 })}
                      className={`w-full px-4 py-2 border rounded-lg text-white font-mono focus:outline-none focus:border-[#00E5FF] ${
                        group.bw_mbps === 0 && group.id !== 0
                          ? 'bg-[#FF6B6B]/10 border-[#FF6B6B]/50'
                          : 'bg-[#132F4C] border-[#1e3a5f]'
                      }`}
                      placeholder="0 表示无限制"
                    />
                    <p className={`text-xs mt-1 ${group.bw_mbps === 0 && group.id !== 0 ? 'text-[#FF6B6B]' : 'text-[#8892B0]'}`}>
                      {group.bw_mbps === 0 && group.id !== 0
                        ? '⚠ 带宽限制为0，该组所有进程将被节流（暂停调度）'
                        : 'MBA (Memory Bandwidth Allocation) 限制，0 表示无限制'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {showAddCLOS && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#132F4C] rounded-xl p-6 w-full max-w-md border border-[#1e3a5f]">
              <h3 className="text-xl font-bold text-white mb-4">添加CLOS组</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#B2BAC2] mb-1">组名称</label>
                  <input
                    type="text"
                    value={newCLOS.name}
                    onChange={(e) => setNewCLOS({ ...newCLOS, name: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                    placeholder="例如: High Priority"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#B2BAC2] mb-1">CBM</label>
                  <input
                    type="text"
                    value={`0x${newCLOS.cbm.toString(16).toUpperCase()}`}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 16);
                      if (!isNaN(val)) setNewCLOS({ ...newCLOS, cbm: val });
                    }}
                    className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white font-mono focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#B2BAC2] mb-1">带宽限制 (MB/s)</label>
                  <input
                    type="number"
                    value={newCLOS.bw_mbps}
                    onChange={(e) => setNewCLOS({ ...newCLOS, bw_mbps: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#B2BAC2] mb-2">颜色</label>
                  <div className="flex gap-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewCLOS({ ...newCLOS, color: c })}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                          newCLOS.color === c ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setShowAddCLOS(false)}
                  className="flex-1 px-4 py-2 border border-[#1e3a5f] text-[#B2BAC2] rounded-lg hover:bg-[#0A1929] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddCLOS}
                  disabled={!newCLOS.name}
                  className="flex-1 px-4 py-2 bg-[#00E5FF] text-[#0A1929] rounded-lg font-medium hover:bg-[#00E5FF]/90 transition-colors disabled:opacity-50"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
