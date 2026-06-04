import { useEffect, useState } from 'react';
import { Server, Database, Activity, Layers, Plus, Ban, Cpu } from 'lucide-react';
import { useStore } from '../store';
import { processApi, simulatorApi, closApi, systemApi } from '../services/api';
import MetricCard from '../components/MetricCard';
import ProcessList from '../components/ProcessList';
import HitRateChart from '../components/HitRateChart';
import BandwidthChart from '../components/BandwidthChart';
import Header from '../components/Header';
import { formatPercent, formatBandwidth } from '../utils/format';

export default function Dashboard() {
  const processes = useStore((s) => s.processes);
  const systemMetrics = useStore((s) => s.systemMetrics);
  const closGroups = useStore((s) => s.closGroups);
  const setCLOSGroups = useStore((s) => s.setCLOSGroups);
  const setSimulatorStatus = useStore((s) => s.setSimulatorStatus);
  const setSystemConfig = useStore((s) => s.setSystemConfig);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [clos, status, config] = await Promise.all([
          closApi.getAll(),
          simulatorApi.getStatus(),
          systemApi.getConfig(),
        ]);
        setCLOSGroups(clos);
        setSimulatorStatus(status);
        setSystemConfig(config);
      } catch (e) {
        console.error('Failed to load initial data:', e);
      }
    };
    loadInitialData();
  }, [setCLOSGroups, setSimulatorStatus, setSystemConfig]);

  const handleToggleStatus = async (pid: number, status: string) => {
    try {
      await processApi.update(pid, { status });
    } catch (e) {
      console.error('Failed to update process status:', e);
    }
  };

  const handleDelete = async (pid: number) => {
    if (confirm('确定要删除此进程吗？')) {
      try {
        await processApi.remove(pid);
      } catch (e) {
        console.error('Failed to delete process:', e);
      }
    }
  };

  const llcUsagePercent = systemMetrics ? (systemMetrics.used_llc / systemMetrics.total_llc) * 100 : 0;
  const bwUsagePercent = systemMetrics ? (systemMetrics.used_bw / systemMetrics.total_bw) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0A1929]">
      <Header
        title="实时监控仪表盘"
        subtitle="Intel RDT 资源监控与分配模拟器"
      />

      <main className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="LLC总使用率"
            value={llcUsagePercent.toFixed(1)}
            unit="%"
            icon={Server}
            color="#00E5FF"
            subtitle={`${systemMetrics?.used_llc.toFixed(1) || '0'} / ${systemMetrics?.total_llc || '100'} 单位`}
            trend={2.3}
          />
          <MetricCard
            title="内存总带宽"
            value={(systemMetrics?.used_bw || 0).toFixed(0)}
            unit="MB/s"
            icon={Database}
            color="#FF9800"
            subtitle={`上限: ${systemMetrics?.total_bw || '10000'} MB/s`}
            trend={-1.5}
          />
          <MetricCard
            title="活跃进程"
            value={String(systemMetrics?.process_count || 0)}
            icon={Activity}
            color="#4CAF50"
            subtitle={processes.filter((p) => p.status === 'running').length + ' 个运行中'}
          />
          <MetricCard
            title="被节流进程"
            value={String(systemMetrics?.throttled_count || 0)}
            icon={Ban}
            color="#FF6B6B"
            subtitle={systemMetrics?.throttled_count ? '带宽限制为0' : '运行正常'}
          />
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">进程管理</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00E5FF] text-[#0A1929] rounded-lg font-medium hover:bg-[#00E5FF]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加进程
          </button>
        </div>

        <ProcessList
          processes={processes}
          closGroups={closGroups}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
        />

        {systemMetrics?.rmid_stats && systemMetrics.rmid_stats.length > 0 && (
          <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B5ECDF]" />
              RMID 隔离统计
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {systemMetrics.rmid_stats.map((stat) => (
                <div
                  key={stat.rmid}
                  className="bg-[#0A1929] rounded-lg p-4 border border-[#1e3a5f]"
                >
                  <div className="text-xs text-[#B2BAC2] mb-2">RMID {stat.rmid}</div>
                  <div className="text-[#B5ECDF] font-mono text-sm mb-1">
                    LLC: {stat.llc_usage.toFixed(1)}
                  </div>
                  <div className="text-[#FF9800] font-mono text-sm">
                    BW: {formatBandwidth(stat.mem_bw)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {systemMetrics?.cat_allocations && systemMetrics.cat_allocations.length > 0 && (
          <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#00E5FF]" />
              CAT 缓存路分配 (Cache Allocation Technology)
            </h3>
            <div className="mb-4">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs text-[#B2BAC2] w-8">Way</span>
                {Array.from({ length: 20 }, (_, i) => (
                  <span key={i} className="text-[10px] text-[#8892B0] w-6 text-center font-mono">
                    {i}
                  </span>
                ))}
              </div>
              {systemMetrics.cat_allocations.map((cat) => {
                const closGroup = closGroups.find((g) => g.id === cat.clos_id);
                const color = closGroup?.color || '#00E5FF';
                return (
                  <div key={cat.clos_id} className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-[#B2BAC2] w-24 truncate font-mono" title={cat.clos_name}>
                      {cat.clos_name}
                    </span>
                    {Array.from({ length: 20 }, (_, i) => {
                      const bitSet = (cat.cbm >> (19 - i)) & 1;
                      return (
                        <div
                          key={i}
                          className={`w-6 h-8 rounded-sm border transition-all duration-300 ${
                            bitSet ? 'border-transparent' : 'border-[#1e3a5f]/30'
                          }`}
                          style={{
                            backgroundColor: bitSet ? color : '#0A1929',
                            opacity: bitSet ? 0.8 : 0.3,
                          }}
                        />
                      );
                    })}
                    <span className="text-xs text-[#B2BAC2] ml-2 font-mono">
                      {cat.cache_ways}/20 路 ({((cat.cache_ways / 20) * 100).toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {systemMetrics.cat_allocations.map((cat) => {
                const closGroup = closGroups.find((g) => g.id === cat.clos_id);
                const color = closGroup?.color || '#00E5FF';
                const usagePercent = cat.llc_capacity > 0 ? (cat.llc_occupancy / cat.llc_capacity) * 100 : 0;
                return (
                  <div key={cat.clos_id} className="bg-[#0A1929] rounded-lg p-3 border border-[#1e3a5f]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-white font-medium">{cat.clos_name}</span>
                    </div>
                    <div className="text-[#B5ECDF] font-mono text-sm">
                      占用: {cat.llc_occupancy.toFixed(1)} / {cat.llc_capacity.toFixed(1)}
                    </div>
                    <div className="h-1.5 bg-[#132F4C] rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(usagePercent, 100)}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="text-xs text-[#8892B0] mt-1">
                      {cat.process_count} 进程 | {cat.way_mask}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HitRateChart processes={processes} closGroups={closGroups} />
          <BandwidthChart processes={processes} closGroups={closGroups} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {processes.slice(0, 3).map((proc) => (
            <div
              key={proc.pid}
              className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6 hover:border-[#00E5FF]/30 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-white font-medium">{proc.name}</h4>
                  <p className="text-xs text-[#B2BAC2] font-mono">PID: {proc.pid}</p>
                </div>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: proc.llc_hit_rate > 0.7 ? '#4CAF50' : '#FF9800' }}
                />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#B2BAC2]">命中率</span>
                    <span className="text-white font-mono">{formatPercent(proc.llc_hit_rate)}</span>
                  </div>
                  <div className="h-2 bg-[#0A1929] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00E5FF] rounded-full transition-all duration-500"
                      style={{ width: `${proc.llc_hit_rate * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#B2BAC2]">带宽</span>
                    <span className="text-white font-mono">{formatBandwidth(proc.mem_bandwidth)}</span>
                  </div>
                  <div className="h-2 bg-[#0A1929] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FF9800] rounded-full transition-all duration-500"
                      style={{ width: `${proc.bw_limit > 0 ? (proc.mem_bandwidth / proc.bw_limit) * 100 : 50}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#132F4C] rounded-xl p-6 w-full max-w-md border border-[#1e3a5f]">
            <h3 className="text-xl font-bold text-white mb-4">添加新进程</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const rmidStr = formData.get('rmid') as string;
                try {
                  await processApi.create({
                    name: formData.get('name') as string,
                    rmid: rmidStr && parseInt(rmidStr) > 0 ? parseInt(rmidStr) : undefined,
                    clos_id: parseInt(formData.get('clos_id') as string),
                    llc_limit: parseFloat(formData.get('llc_limit') as string),
                    bw_limit: parseFloat(formData.get('bw_limit') as string),
                    priority: parseInt(formData.get('priority') as string),
                  });
                  setShowAddModal(false);
                } catch (err) {
                  console.error('Failed to create process:', err);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-[#B2BAC2] mb-1">进程名称</label>
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                  placeholder="例如: my-app"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#B2BAC2] mb-1">RMID</label>
                  <input
                    name="rmid"
                    type="number"
                    min="0"
                    className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                    placeholder="0=自动分配"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#B2BAC2] mb-1">CLOS组</label>
                  <select
                    name="clos_id"
                    className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                  >
                    {closGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#B2BAC2] mb-1">LLC限制</label>
                  <input
                    name="llc_limit"
                    type="number"
                    defaultValue={20}
                    className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#B2BAC2] mb-1">带宽限制</label>
                  <input
                    name="bw_limit"
                    type="number"
                    defaultValue={2000}
                    className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#B2BAC2] mb-1">优先级</label>
                <select
                  name="priority"
                  className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                >
                  <option value={1}>高</option>
                  <option value={2}>中</option>
                  <option value={3}>低</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-[#1e3a5f] text-[#B2BAC2] rounded-lg hover:bg-[#0A1929] transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00E5FF] text-[#0A1929] rounded-lg font-medium hover:bg-[#00E5FF]/90 transition-colors"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
