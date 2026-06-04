import { useEffect, useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { IOResult } from '@/utils/api';

export function Logs() {
  const { logsByNS, loadLogs, namespaces, selectedNS, setSelectedNS } = useSimulatorStore();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logs = logsByNS[selectedNS] || [];

  useEffect(() => {
    loadLogs(selectedNS);
  }, [loadLogs, selectedNS]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadLogs(selectedNS);
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadLogs, selectedNS]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + `.${String(d.getMilliseconds()).padStart(3, '0')}`;
  };

  const sortedLogs = [...logs].reverse();

  return (
    <div className="min-h-screen bg-nvme-bg text-nvme-text font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-nvme-border bg-nvme-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-mono text-nvme-textDim hover:text-nvme-cyan transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回控制台
          </Link>
          <h1 className="font-mono text-lg font-bold text-nvme-cyan tracking-wider">
            命令执行日志
          </h1>
          <div className="flex items-center gap-1 ml-4">
            {namespaces.map((ns) => (
              <button
                key={ns}
                onClick={() => setSelectedNS(ns)}
                className={`px-3 py-1 text-xs font-mono rounded-md border transition-all ${
                  selectedNS === ns
                    ? 'text-nvme-cyan border-nvme-cyan/30 bg-nvme-cyan/10'
                    : 'text-nvme-textDim border-nvme-border hover:border-nvme-cyan/50 hover:text-nvme-cyan'
                }`}
              >
                {ns}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-mono text-nvme-textDim cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-nvme-cyan"
            />
            自动刷新
          </label>
          <button
            onClick={() => loadLogs(selectedNS)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-nvme-cyan border border-nvme-cyan/30 rounded-md bg-nvme-cyan/10 hover:bg-nvme-cyan/20 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
          <span className="text-xs font-mono text-nvme-textMuted">
            共 {logs.length} 条记录
          </span>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="rounded-xl border border-nvme-border bg-nvme-surface overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-nvme-border bg-nvme-bg">
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-nvme-textDim">#</th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-nvme-textDim">时间戳</th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-nvme-textDim">命令ID</th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-nvme-textDim">窗口状态</th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-nvme-textDim">结果</th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-nvme-textDim">in-flight</th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-nvme-textDim">错误信息</th>
              </tr>
            </thead>
            <tbody>
              {sortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs font-mono text-nvme-textMuted">
                    暂无日志记录，请启动模拟器并提交IO命令
                  </td>
                </tr>
              ) : (
                sortedLogs.map((log, i) => (
                  <tr
                    key={log.id}
                    className={`border-b border-nvme-border/30 hover:bg-nvme-surfaceLight/50 transition-colors ${
                      log.success ? '' : 'bg-nvme-red/5'
                    }`}
                  >
                    <td className="px-4 py-2 text-xs font-mono text-nvme-textMuted">
                      {logs.length - i}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-nvme-textDim">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-nvme-textDim">
                      {log.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                          log.windowOpen
                            ? 'text-nvme-green bg-nvme-green/10 border border-nvme-green/30'
                            : 'text-nvme-red bg-nvme-red/10 border border-nvme-red/30'
                        }`}
                      >
                        {log.windowOpen ? '开启' : '关闭'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                          log.success
                            ? 'text-nvme-green bg-nvme-green/10 border border-nvme-green/30'
                            : 'text-nvme-red bg-nvme-red/10 border border-nvme-red/30'
                        }`}
                      >
                        {log.success ? '成功' : '拒绝'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-nvme-textDim">
                      {log.inFlight ?? 0}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-nvme-textMuted">
                      {log.errorMessage || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
