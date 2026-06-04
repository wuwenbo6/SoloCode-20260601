import { useSimulatorStore } from '@/store/simulatorStore';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { getReportUrl } from '@/utils/api';
import { useState } from 'react';

interface Props {
  namespace: string;
}

export function UtilizationPanel({ namespace }: Props) {
  const { statuses } = useSimulatorStore();
  const status = statuses[namespace];
  const [showExport, setShowExport] = useState(false);

  const cycleUtilPct = status?.cycleUtilPct ?? 0;
  const stats = status?.stats ?? { totalAttempts: 0, successCount: 0, rejectedCount: 0 };
  const effectiveUtilPct = stats.totalAttempts > 0
    ? (stats.successCount / stats.totalAttempts * 100)
    : 0;

  const windows = status?.windows ?? [];
  const cycleMs = status?.cycleMs || 10000;
  const totalWindowMs = windows.reduce((sum, w) => sum + w.durationMs, 0);
  const totalGapMs = cycleMs - totalWindowMs;

  const formatMs = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  return (
    <div className="p-4 rounded-xl border border-nvme-border bg-nvme-surface">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-sm font-semibold text-nvme-cyan tracking-wide">
          窗口利用率
        </h3>
        <div className="relative">
          <button
            onClick={() => setShowExport(!showExport)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-nvme-cyan border border-nvme-cyan/30 rounded-md bg-nvme-cyan/10 hover:bg-nvme-cyan/20 transition-all"
          >
            <Download className="w-3 h-3" />
            导出报表
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-nvme-surface border border-nvme-border rounded-lg shadow-xl overflow-hidden">
              <a
                href={getReportUrl('json', namespace)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-nvme-textDim hover:bg-nvme-cyan/10 hover:text-nvme-cyan transition-all"
              >
                <FileJson className="w-3.5 h-3.5" />
                导出 JSON
              </a>
              <a
                href={getReportUrl('csv', namespace)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-nvme-textDim hover:bg-nvme-cyan/10 hover:text-nvme-cyan transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                导出 CSV
              </a>
              <a
                href={getReportUrl('csv')}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-nvme-textDim hover:bg-nvme-cyan/10 hover:text-nvme-cyan transition-all border-t border-nvme-border/50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                导出全部 NS (CSV)
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-nvme-textDim w-28">周期利用率</span>
          <div className="flex-1 h-3 rounded-full bg-nvme-bg overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-nvme-cyan to-nvme-green transition-all duration-500"
              style={{ width: `${cycleUtilPct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-nvme-cyan w-14 text-right">{cycleUtilPct.toFixed(1)}%</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-nvme-textDim w-28">有效利用率</span>
          <div className="flex-1 h-3 rounded-full bg-nvme-bg overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-nvme-green to-amber-400 transition-all duration-500"
              style={{ width: `${effectiveUtilPct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-nvme-green w-14 text-right">{effectiveUtilPct.toFixed(1)}%</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="p-2 rounded-lg bg-nvme-bg border border-nvme-border/50 text-center">
            <p className="text-[10px] font-mono text-nvme-textMuted">窗口总时长</p>
            <p className="text-sm font-mono font-bold text-nvme-cyan">{formatMs(totalWindowMs)}</p>
          </div>
          <div className="p-2 rounded-lg bg-nvme-bg border border-nvme-border/50 text-center">
            <p className="text-[10px] font-mono text-nvme-textMuted">间隙总时长</p>
            <p className="text-sm font-mono font-bold text-nvme-red">{formatMs(totalGapMs > 0 ? totalGapMs : 0)}</p>
          </div>
        </div>

        <div className="space-y-1.5 mt-2">
          {windows.map((w, i) => {
            const wPct = (w.durationMs / cycleMs * 100);
            return (
              <div key={w.id || i} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-nvme-textMuted w-6">W{i + 1}</span>
                <div className="flex-1 h-1.5 rounded-full bg-nvme-bg overflow-hidden">
                  <div
                    className="h-full rounded-full bg-nvme-cyan/60"
                    style={{ width: `${wPct}%` }}
                  />
                </div>
                <span className="text-nvme-textDim w-20 text-right">
                  {formatMs(w.startOffsetMs)}-{formatMs(w.startOffsetMs + w.durationMs)}
                </span>
                <span className="text-nvme-cyan w-12 text-right">{wPct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
