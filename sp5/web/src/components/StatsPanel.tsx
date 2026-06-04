import { useSimulatorStore } from '@/store/simulatorStore';

interface Props {
  namespace: string;
}

export function StatsPanel({ namespace }: Props) {
  const { statuses } = useSimulatorStore();
  const status = statuses[namespace];
  const stats = status?.stats ?? { totalAttempts: 0, successCount: 0, rejectedCount: 0 };
  const successRate = stats.totalAttempts > 0
    ? ((stats.successCount / stats.totalAttempts) * 100).toFixed(1)
    : '0.0';

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (parseFloat(successRate) / 100) * circumference;

  return (
    <div className="p-4 rounded-xl border border-nvme-border bg-nvme-surface">
      <h3 className="font-mono text-sm font-semibold text-nvme-cyan tracking-wide mb-4">
        统计仪表盘
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-nvme-bg border border-nvme-border/50 text-center">
          <p className="text-xs font-mono text-nvme-textMuted mb-1">总尝试</p>
          <p className="text-2xl font-mono font-bold text-nvme-text">
            {stats.totalAttempts}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-nvme-bg border border-nvme-border/50 text-center">
          <p className="text-xs font-mono text-nvme-textMuted mb-1">成功</p>
          <p className="text-2xl font-mono font-bold text-nvme-green">
            {stats.successCount}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-nvme-bg border border-nvme-border/50 text-center">
          <p className="text-xs font-mono text-nvme-textMuted mb-1">拒绝</p>
          <p className="text-2xl font-mono font-bold text-nvme-red">
            {stats.rejectedCount}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-nvme-bg border border-nvme-border/50 flex items-center justify-center">
          <svg width="80" height="80" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="#1e293b"
              strokeWidth="8"
            />
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="#00e5ff"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              className="transition-all duration-500"
            />
            <text
              x="50" y="50"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-nvme-text font-mono text-sm font-bold"
              style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace' }}
            >
              {successRate}%
            </text>
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-nvme-bg overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-nvme-green to-nvme-cyan transition-all duration-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
          <span className="text-xs font-mono text-nvme-textDim w-12 text-right">{successRate}%</span>
        </div>
        <p className="text-[10px] font-mono text-nvme-textMuted text-center">成功率</p>
      </div>
    </div>
  );
}
