import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Home, Radio, AlertTriangle, X } from 'lucide-react';
import { useStore } from '@/hooks/useStore';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const wsConnected = useStore((s) => s.wsConnected);
  const warnings = useStore((s) => s.warnings);
  const dismissWarning = useStore((s) => s.dismissWarning);

  const isHome = location.pathname === '/';

  return (
    <div className="flex min-h-screen">
      <nav className="w-16 bg-slate-900/80 border-r border-slate-700/50 flex flex-col items-center py-4 gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-6">
          <Activity className="w-5 h-5 text-white" />
        </div>

        <button
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            isHome ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          onClick={() => navigate('/')}
          title="仪表盘"
        >
          <Home className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        <div className="flex flex-col items-center gap-1 relative">
          <Radio className={`w-4 h-4 ${wsConnected ? 'text-emerald-400 animate-pulse-glow' : 'text-red-400'}`} />
          <span className="text-[10px] text-slate-500">WS</span>
          {warnings.length > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[8px] text-white flex items-center justify-center">
              {warnings.length > 9 ? '9+' : warnings.length}
            </span>
          )}
        </div>
      </nav>

      <div className="flex-1 flex flex-col overflow-hidden">
        {warnings.length > 0 && (
          <div className="border-b border-amber-500/30 bg-amber-950/30 max-h-40 overflow-y-auto">
            {warnings.map((w) => (
              <div
                key={w.id}
                className="flex items-start gap-3 px-5 py-2.5 text-sm border-b border-amber-500/10 last:border-b-0"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-amber-300 font-medium">
                    模板拒绝
                  </span>
                  <span className="text-amber-200/70 ml-2">
                    观测点 <span className="font-mono">{w.sourceId}</span> 模板{' '}
                    <span className="font-mono">{w.templateId}</span>：
                    <span className="font-mono text-xs">{w.reason}</span>
                  </span>
                </div>
                <button
                  className="text-amber-400/50 hover:text-amber-300 shrink-0"
                  onClick={() => dismissWarning(w.id)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
