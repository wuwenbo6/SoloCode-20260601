import { Link } from 'react-router-dom';
import { Play, Pause, Trash2, ChevronRight, HardDrive, Activity, Ban } from 'lucide-react';
import type { Process, CLOSGroup } from '../types';
import { formatPercent, formatBandwidth, getCLOSColor, getStatusColor } from '../utils/format';

interface ProcessListProps {
  processes: Process[];
  closGroups: CLOSGroup[];
  onToggleStatus?: (pid: number, status: string) => void;
  onDelete?: (pid: number) => void;
}

export default function ProcessList({ processes, closGroups, onToggleStatus, onDelete }: ProcessListProps) {
  const throttledCount = processes.filter((p) => p.throttled).length;

  return (
    <div className="bg-[#132F4C] rounded-xl border border-[#1e3a5f] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e3a5f] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-[#00E5FF]" />
          <h3 className="text-white font-semibold">进程列表</h3>
          <span className="text-xs text-[#B2BAC2] bg-[#0A1929] px-2 py-1 rounded-full">
            {processes.length} 个进程
          </span>
          {throttledCount > 0 && (
            <span className="text-xs text-[#FF6B6B] bg-[#FF6B6B]/15 px-2 py-1 rounded-full flex items-center gap-1">
              <Ban className="w-3 h-3" />
              {throttledCount} 个被节流
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0A1929]/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-[#B2BAC2] uppercase tracking-wider">
                PID / 名称
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-[#B2BAC2] uppercase tracking-wider">
                RMID
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-[#B2BAC2] uppercase tracking-wider">
                CLOS组
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-[#B2BAC2] uppercase tracking-wider">
                LLC使用率
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-[#B2BAC2] uppercase tracking-wider">
                LLC命中率
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-[#B2BAC2] uppercase tracking-wider">
                带宽使用
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-[#B2BAC2] uppercase tracking-wider">
                状态
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-[#B2BAC2] uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e3a5f]">
            {processes.map((proc) => {
              const closColor = getCLOSColor(proc.clos_id, closGroups);
              const statusColor = proc.throttled ? '#FF6B6B' : getStatusColor(proc.status);
              const llcPercent = proc.llc_limit > 0 ? (proc.llc_usage / proc.llc_limit) * 100 : 0;
              const bwPercent = proc.bw_limit > 0 ? (proc.mem_bandwidth / proc.bw_limit) * 100 : 0;

              return (
                <tr
                  key={proc.pid}
                  className={`hover:bg-[#0A1929]/30 transition-colors group ${proc.throttled ? 'opacity-60' : ''}`}
                >
                  <td className="px-6 py-4">
                    <Link
                      to={`/process/${proc.pid}`}
                      className="flex items-center gap-3"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${proc.throttled ? 'animate-none' : 'animate-pulse'}`}
                        style={{ backgroundColor: statusColor }}
                      />
                      <div>
                        <p className="text-white font-medium">{proc.name}</p>
                        <p className="text-xs text-[#B2BAC2] font-mono">PID: {proc.pid}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#B2BAC2] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 bg-[#0A1929] rounded text-xs font-mono text-[#B5ECDF]">
                      RMID {proc.rmid}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: closColor }}
                      />
                      <span className="text-sm text-white">
                        {closGroups.find((g) => g.id === proc.clos_id)?.name || 'Default'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white font-mono">
                          {proc.llc_usage.toFixed(1)}
                        </span>
                        <span className="text-xs text-[#B2BAC2]">/ {proc.llc_limit || '∞'}</span>
                      </div>
                      <div className="h-2 bg-[#0A1929] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(llcPercent, 100)}%`,
                            backgroundColor: closColor,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4" style={{ color: closColor }} />
                      <span
                        className={`font-mono font-medium ${
                          proc.llc_hit_rate > 0.8
                            ? 'text-[#4CAF50]'
                            : proc.llc_hit_rate > 0.5
                            ? 'text-[#FF9800]'
                            : 'text-[#F44336]'
                        }`}
                      >
                        {formatPercent(proc.llc_hit_rate)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white font-mono">
                          {formatBandwidth(proc.mem_bandwidth)}
                        </span>
                        <span className="text-xs text-[#B2BAC2]">/ {proc.bw_limit || '∞'}</span>
                      </div>
                      <div className="h-2 bg-[#0A1929] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#FF9800] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(bwPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {proc.throttled ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: 'rgba(255, 107, 107, 0.15)',
                          color: '#FF6B6B',
                        }}
                      >
                        <Ban className="w-3 h-3" />
                        已节流
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${statusColor}15`,
                          color: statusColor,
                        }}
                      >
                        {proc.status === 'running' ? '运行中' : proc.status === 'paused' ? '已暂停' : '已停止'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onToggleStatus?.(proc.pid, proc.status === 'running' ? 'paused' : 'running')}
                        className="p-2 rounded-lg hover:bg-[#0A1929] text-[#B2BAC2] hover:text-white transition-colors"
                        title={proc.status === 'running' ? '暂停' : '恢复'}
                      >
                        {proc.status === 'running' ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onDelete?.(proc.pid)}
                        className="p-2 rounded-lg hover:bg-[#F44336]/10 text-[#B2BAC2] hover:text-[#F44336] transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
