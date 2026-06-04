import { useNavigate } from 'react-router-dom';
import { useStore } from '@/hooks/useStore';
import { ChevronRight } from 'lucide-react';

export function ObserverTable() {
  const observers = useStore((s) => s.observers);
  const navigate = useNavigate();

  return (
    <div className="gradient-border p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/50">
        <h2 className="text-lg font-semibold text-white">观测点列表</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/30">
              <th className="text-left px-5 py-3 text-slate-400 font-medium">Source ID</th>
              <th className="text-left px-5 py-3 text-slate-400 font-medium">地址</th>
              <th className="text-left px-5 py-3 text-slate-400 font-medium">模板数</th>
              <th className="text-left px-5 py-3 text-slate-400 font-medium">流记录数</th>
              <th className="text-left px-5 py-3 text-slate-400 font-medium">最近活跃</th>
              <th className="text-right px-5 py-3 text-slate-400 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {observers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                  暂无观测点数据，请启动 NetFlow 导出器发送数据
                </td>
              </tr>
            ) : (
              observers.map((obs) => (
                <tr
                  key={obs.sourceId}
                  className="border-b border-slate-700/20 hover:bg-cyan-950/20 cursor-pointer transition-colors"
                  onClick={() => navigate(`/observer/${obs.sourceId}`)}
                >
                  <td className="px-5 py-3">
                    <span className="font-mono text-cyan-400">{obs.sourceId}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-300">{obs.address}</td>
                  <td className="px-5 py-3">
                    <span className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded text-xs font-mono">
                      {obs.templateCount}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-xs font-mono">
                      {obs.flowCount}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {new Date(obs.lastSeen).toLocaleTimeString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-500 inline-block" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
