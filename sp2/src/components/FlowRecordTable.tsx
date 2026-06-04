import { useStore } from '@/hooks/useStore';
import { fetchFlows } from '@/lib/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback } from 'react';

export function FlowRecordTable() {
  const flows = useStore((s) => s.flows);
  const flowTotal = useStore((s) => s.flowTotal);
  const flowPage = useStore((s) => s.flowPage);
  const flowPageSize = useStore((s) => s.flowPageSize);
  const selectedObserver = useStore((s) => s.selectedObserver);
  const selectedTemplate = useStore((s) => s.selectedTemplate);
  const setFlows = useStore((s) => s.setFlows);

  const totalPages = Math.ceil(flowTotal / flowPageSize);

  const goToPage = useCallback(
    async (page: number) => {
      if (selectedObserver === null) return;
      try {
        const res = await fetchFlows(
          selectedObserver,
          selectedTemplate || undefined,
          page,
          flowPageSize
        );
        setFlows(res.flows, res.total, res.page, res.pageSize);
      } catch {}
    },
    [selectedObserver, selectedTemplate, flowPageSize, setFlows]
  );

  if (flows.length === 0) {
    return (
      <div className="gradient-border p-8 text-center text-slate-500">
        暂无流记录数据
      </div>
    );
  }

  const columns = flows.length > 0 ? Object.keys(flows[0].fields || {}) : [];

  return (
    <div className="gradient-border p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          流记录
          <span className="text-sm font-normal text-slate-400 ml-2">
            共 {flowTotal} 条
          </span>
        </h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <button
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-30"
            disabled={flowPage <= 1}
            onClick={() => goToPage(flowPage - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono">
            {flowPage} / {totalPages || 1}
          </span>
          <button
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-30"
            disabled={flowPage >= totalPages}
            onClick={() => goToPage(flowPage + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/30">
              <th className="text-left px-5 py-2 text-slate-400 font-medium text-xs">时间</th>
              <th className="text-left px-5 py-2 text-slate-400 font-medium text-xs">模板</th>
              {columns.map((col) => (
                <th key={col} className="text-left px-5 py-2 text-slate-400 font-medium text-xs whitespace-nowrap">
                  {col.replace(/_\d+$/, '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flows.map((flow, i) => (
              <tr key={i} className="border-b border-slate-700/10 hover:bg-cyan-950/10">
                <td className="px-5 py-2 text-slate-500 text-xs font-mono whitespace-nowrap">
                  {new Date(flow.receivedAt).toLocaleTimeString()}
                </td>
                <td className="px-5 py-2 text-amber-400 text-xs font-mono">{flow.templateId}</td>
                {columns.map((col) => (
                  <td key={col} className="px-5 py-2 font-mono text-xs text-slate-300 whitespace-nowrap">
                    {formatFieldValue(flow.fields[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}
