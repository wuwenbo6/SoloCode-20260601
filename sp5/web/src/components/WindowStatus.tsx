import { useSimulatorStore } from '@/store/simulatorStore';

interface Props {
  namespace: string;
}

export function WindowStatus({ namespace }: Props) {
  const { statuses } = useSimulatorStore();
  const status = statuses[namespace];
  const running = status?.running ?? false;
  const windowOpen = status?.currentWindowOpen ?? false;
  const nextOpen = status?.nextWindowOpenInMs ?? 0;
  const inFlight = status?.inFlight ?? 0;

  return (
    <div className="p-4 rounded-xl border border-nvme-border bg-nvme-surface">
      <h3 className="font-mono text-sm font-semibold text-nvme-cyan tracking-wide mb-4">
        窗口状态
      </h3>

      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-300 ${
              !running
                ? 'border-nvme-textMuted bg-nvme-textMuted/5'
                : windowOpen
                ? 'border-nvme-green bg-nvme-green/10 shadow-[0_0_30px_rgba(0,224,150,0.3)]'
                : 'border-nvme-red bg-nvme-red/10 shadow-[0_0_30px_rgba(255,61,113,0.3)]'
            }`}
          >
            <span
              className={`font-mono text-base font-bold ${
                !running
                  ? 'text-nvme-textMuted'
                  : windowOpen
                  ? 'text-nvme-green'
                  : 'text-nvme-red'
              }`}
            >
              {!running ? 'OFF' : windowOpen ? 'OPEN' : 'CLOSED'}
            </span>
            {running && inFlight > 0 && (
              <span className="text-[10px] font-mono text-nvme-cyan mt-1">
                in-flight: {inFlight}
              </span>
            )}
          </div>
          {running && (
            <div
              className={`absolute -inset-1 rounded-full animate-ping opacity-20 ${
                windowOpen ? 'bg-nvme-green' : 'bg-nvme-red'
              }`}
            />
          )}
        </div>

        <div className="text-center">
          {running ? (
            !windowOpen && (
              <div className="space-y-1">
                <p className="text-xs font-mono text-nvme-textDim">下一窗口开启</p>
                <p className="text-2xl font-mono font-bold text-nvme-cyan">
                  {nextOpen}
                  <span className="text-xs text-nvme-textMuted ml-1">ms</span>
                </p>
              </div>
            )
          ) : (
            <p className="text-xs font-mono text-nvme-textMuted">
              模拟器未启动
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
