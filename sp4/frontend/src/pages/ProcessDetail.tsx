import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Ban } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useStore } from '../store';
import { processApi, closApi } from '../services/api';
import type { MetricsHistory, Process, CLOSGroup } from '../types';
import { formatPercent, formatBandwidth, formatDateTime, getCLOSColor, getStatusColor } from '../utils/format';
import Header from '../components/Header';

export default function ProcessDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const processes = useStore((s) => s.processes);
  const closGroups = useStore((s) => s.closGroups);
  const setCLOSGroups = useStore((s) => s.setCLOSGroups);

  const [process, setProcess] = useState<Process | null>(null);
  const [history, setHistory] = useState<MetricsHistory[]>([]);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    rmid: 0,
    clos_id: 0,
    llc_limit: 0,
    bw_limit: 0,
    priority: 1,
  });

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const [proc, hist, clos] = await Promise.all([
          processApi.get(parseInt(id)),
          processApi.getHistory(parseInt(id), '10m'),
          closApi.getAll(),
        ]);
        setProcess(proc);
        setHistory(hist);
        setCLOSGroups(clos);
        setFormData({
          name: proc.name,
          rmid: proc.rmid,
          clos_id: proc.clos_id,
          llc_limit: proc.llc_limit,
          bw_limit: proc.bw_limit,
          priority: proc.priority,
        });
      } catch (e) {
        console.error('Failed to load process data:', e);
      }
    };
    loadData();
  }, [id, setCLOSGroups]);

  useEffect(() => {
    if (id && processes.length > 0) {
      const liveProc = processes.find((p) => p.pid === parseInt(id));
      if (liveProc && process) {
        setProcess({
          ...process,
          llc_usage: liveProc.llc_usage,
          llc_hit_rate: liveProc.llc_hit_rate,
          mem_bandwidth: liveProc.mem_bandwidth,
          read_bandwidth: liveProc.read_bandwidth,
          write_bandwidth: liveProc.write_bandwidth,
          status: liveProc.status,
          throttled: liveProc.throttled,
        });
      }
    }
  }, [processes, id, process]);

  const handleSave = async () => {
    if (!id) return;
    try {
      const updateData = {
        ...formData,
        rmid: formData.rmid,
      };
      const updated = await processApi.update(parseInt(id), updateData);
      setProcess(updated);
      setEditing(false);
    } catch (e) {
      console.error('Failed to update process:', e);
    }
  };

  const hitRateChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 25, 41, 0.95)',
      borderColor: '#132F4C',
      textStyle: { color: '#fff' },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: history.map((h) => formatDateTime(h.timestamp)),
      axisLine: { lineStyle: { color: '#1e3a5f' } },
      axisLabel: { color: '#B2BAC2', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: {
        color: '#B2BAC2',
        formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
      },
      axisLine: { lineStyle: { color: '#1e3a5f' } },
      splitLine: { lineStyle: { color: '#1e3a5f', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#00E5FF' },
        itemStyle: { color: '#00E5FF' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#00E5FF40' },
              { offset: 1, color: '#00E5FF00' },
            ],
          },
        },
        data: history.map((h) => h.llc_hit_rate),
      },
    ],
  };

  const bwChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 25, 41, 0.95)',
      borderColor: '#132F4C',
      textStyle: { color: '#fff' },
    },
    legend: {
      data: ['读取带宽', '写入带宽'],
      top: 0,
      right: 0,
      textStyle: { color: '#B2BAC2', fontSize: 11 },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: history.map((h) => formatDateTime(h.timestamp)),
      axisLine: { lineStyle: { color: '#1e3a5f' } },
      axisLabel: { color: '#B2BAC2', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: 'MB/s',
      axisLabel: { color: '#B2BAC2', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e3a5f' } },
      splitLine: { lineStyle: { color: '#1e3a5f', type: 'dashed' } },
    },
    series: [
      {
        name: '读取带宽',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#4CAF50', borderRadius: [4, 4, 0, 0] },
        data: history.map((h) => h.mem_bw * 0.6),
      },
      {
        name: '写入带宽',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#FF9800', borderRadius: [4, 4, 0, 0] },
        data: history.map((h) => h.mem_bw * 0.4),
      },
    ],
  };

  if (!process) {
    return (
      <div className="min-h-screen bg-[#0A1929] flex items-center justify-center">
        <div className="text-[#B2BAC2]">加载中...</div>
      </div>
    );
  }

  const closColor = getCLOSColor(process.clos_id, closGroups);
  const statusColor = getStatusColor(process.status);

  return (
    <div className="min-h-screen bg-[#0A1929]">
      <Header title={`进程详情 - ${process.name}`} subtitle={`PID: ${process.pid}`} />

      <main className="p-8 space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#B2BAC2] hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回监控台
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-semibold">基本信息</h3>
                <button
                  onClick={() => setEditing(!editing)}
                  className="text-sm text-[#00E5FF] hover:text-[#00E5FF]/80 transition-colors"
                >
                  {editing ? '取消编辑' : '编辑配置'}
                </button>
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#B2BAC2] mb-1">进程名称</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#B2BAC2] mb-1">RMID (资源监控ID)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.rmid}
                      onChange={(e) => setFormData({ ...formData, rmid: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#B2BAC2] mb-1">CLOS组</label>
                    <select
                      value={formData.clos_id}
                      onChange={(e) => setFormData({ ...formData, clos_id: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                    >
                      {closGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#B2BAC2] mb-1">LLC限制</label>
                    <input
                      type="number"
                      value={formData.llc_limit}
                      onChange={(e) => setFormData({ ...formData, llc_limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#B2BAC2] mb-1">带宽限制 (MB/s)</label>
                    <input
                      type="number"
                      value={formData.bw_limit}
                      onChange={(e) => setFormData({ ...formData, bw_limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#B2BAC2] mb-1">优先级</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-[#0A1929] border border-[#1e3a5f] rounded-lg text-white focus:outline-none focus:border-[#00E5FF]"
                    >
                      <option value={1}>高</option>
                      <option value={2}>中</option>
                      <option value={3}>低</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSave}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#00E5FF] text-[#0A1929] rounded-lg font-medium hover:bg-[#00E5FF]/90 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    保存配置
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-[#1e3a5f]">
                    <span className="text-[#B2BAC2]">PID</span>
                    <span className="text-white font-mono">{process.pid}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e3a5f]">
                    <span className="text-[#B2BAC2]">RMID</span>
                    <span className="text-[#B5ECDF] font-mono">{process.rmid}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e3a5f]">
                    <span className="text-[#B2BAC2]">进程名</span>
                    <span className="text-white">{process.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e3a5f]">
                    <span className="text-[#B2BAC2]">状态</span>
                    {process.throttled ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'rgba(255, 107, 107, 0.15)', color: '#FF6B6B' }}
                      >
                        <Ban className="w-3 h-3" />
                        已节流 (带宽限制为0)
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
                      >
                        {process.status === 'running' ? '运行中' : '已暂停'}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e3a5f]">
                    <span className="text-[#B2BAC2]">CLOS组</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: closColor }} />
                      <span className="text-white">
                        {closGroups.find((g) => g.id === process.clos_id)?.name || 'Default'}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e3a5f]">
                    <span className="text-[#B2BAC2]">优先级</span>
                    <span className="text-white">{process.priority === 1 ? '高' : process.priority === 2 ? '中' : '低'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#1e3a5f]">
                    <span className="text-[#B2BAC2]">启动时间</span>
                    <span className="text-white font-mono text-sm">{formatDateTime(process.start_time)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#B2BAC2]">LLC限制</span>
                    <span className="text-white font-mono">{process.llc_limit || '无限制'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#B2BAC2]">带宽限制</span>
                    <span className="text-white font-mono">{process.bw_limit ? `${process.bw_limit} MB/s` : '无限制'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
              <h3 className="text-white font-semibold mb-4">实时指标</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-[#B2BAC2]">LLC命中率</span>
                    <span
                      className={`font-mono font-bold ${
                        process.llc_hit_rate > 0.8 ? 'text-[#4CAF50]' : process.llc_hit_rate > 0.5 ? 'text-[#FF9800]' : 'text-[#F44336]'
                      }`}
                    >
                      {formatPercent(process.llc_hit_rate)}
                    </span>
                  </div>
                  <div className="h-3 bg-[#0A1929] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00E5FF] to-[#0077B6] rounded-full transition-all duration-500"
                      style={{ width: `${process.llc_hit_rate * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-[#B2BAC2]">LLC使用量</span>
                    <span className="text-white font-mono">
                      {process.llc_usage.toFixed(1)} / {process.llc_limit || '∞'}
                    </span>
                  </div>
                  <div className="h-3 bg-[#0A1929] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${process.llc_limit > 0 ? Math.min((process.llc_usage / process.llc_limit) * 100, 100) : 50}%`,
                        backgroundColor: closColor,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-[#B2BAC2]">内存带宽</span>
                    <span className="text-white font-mono">{formatBandwidth(process.mem_bandwidth)}</span>
                  </div>
                  <div className="h-3 bg-[#0A1929] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FF9800] to-[#F44336] rounded-full transition-all duration-500"
                      style={{
                        width: `${process.bw_limit > 0 ? Math.min((process.mem_bandwidth / process.bw_limit) * 100, 100) : 50}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-[#0A1929] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#B2BAC2] mb-1">读取带宽</p>
                    <p className="text-[#4CAF50] font-mono font-bold">{formatBandwidth(process.read_bandwidth)}</p>
                  </div>
                  <div className="bg-[#0A1929] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#B2BAC2] mb-1">写入带宽</p>
                    <p className="text-[#FF9800] font-mono font-bold">{formatBandwidth(process.write_bandwidth)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
              <h3 className="text-white font-semibold mb-4">LLC命中率历史</h3>
              <ReactECharts option={hitRateChartOption} style={{ height: '250px' }} />
            </div>
            <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] p-6">
              <h3 className="text-white font-semibold mb-4">带宽使用历史</h3>
              <ReactECharts option={bwChartOption} style={{ height: '250px' }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
