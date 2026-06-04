import { useSimulatorStore } from '@/store/simulatorStore';

interface Props {
  namespace: string;
}

export function Timeline({ namespace }: Props) {
  const { statuses } = useSimulatorStore();
  const status = statuses[namespace];
  const windows = status?.windows ?? [];
  const cycleMs = status?.cycleMs || 10000;
  const cyclePos = status?.cyclePositionMs ?? 0;
  const running = status?.running ?? false;

  const positionPercent = running ? (cyclePos / cycleMs) * 100 : 0;

  const windowColors = [
    { bg: 'bg-nvme-cyan/25', border: 'border-nvme-cyan/40' },
    { bg: 'bg-nvme-green/25', border: 'border-nvme-green/40' },
    { bg: 'bg-purple-500/25', border: 'border-purple-500/40' },
    { bg: 'bg-amber-500/25', border: 'border-amber-500/40' },
  ];

  const formatMs = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  const ticks = [];
  const tickCount = Math.min(Math.ceil(cycleMs / 1000), 20);
  for (let i = 0; i <= tickCount; i++) {
    const ms = (cycleMs / tickCount) * i;
    ticks.push({ ms, percent: (ms / cycleMs) * 100, label: formatMs(Math.round(ms)) });
  }

  return (
    <div className="p-4 rounded-xl border border-nvme-border bg-nvme-surface">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-sm font-semibold text-nvme-cyan tracking-wide">
          周期时间轴
        </h3>
        <span className="text-xs font-mono text-nvme-textMuted">
          周期: {formatMs(cycleMs)}
        </span>
      </div>

      <div className="relative h-16 mb-2">
        <div className="absolute inset-0 rounded-lg bg-nvme-bg border border-nvme-border/50 overflow-hidden">
          {windows.map((w, i) => {
            const left = (w.startOffsetMs / cycleMs) * 100;
            const width = (w.durationMs / cycleMs) * 100;
            const color = windowColors[i % windowColors.length];
            return (
              <div
                key={w.id || i}
                className={`absolute top-0 h-full ${color.bg} ${color.border} border-l border-r`}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <div className="absolute inset-x-0 top-0 flex items-center justify-center h-full">
                  <span className="text-[9px] font-mono text-nvme-textDim whitespace-nowrap">
                    W{i + 1}: {formatMs(w.startOffsetMs)}-{formatMs(w.startOffsetMs + w.durationMs)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {running && (
          <div
            className="absolute top-0 w-0.5 h-full bg-nvme-text shadow-[0_0_8px_rgba(226,232,240,0.8)] z-10 transition-all duration-100"
            style={{ left: `${positionPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-nvme-text rounded-full" />
          </div>
        )}
      </div>

      <div className="relative h-4">
        {ticks.map((tick, i) => (
          <div
            key={i}
            className="absolute text-[9px] font-mono text-nvme-textMuted"
            style={{ left: `${tick.percent}%`, transform: 'translateX(-50%)' }}
          >
            {tick.label}
          </div>
        ))}
      </div>
    </div>
  );
}
