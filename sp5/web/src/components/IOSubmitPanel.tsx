import { useSimulatorStore } from '@/store/simulatorStore';
import { Send } from 'lucide-react';

interface Props {
  namespace: string;
}

export function IOSubmitPanel({ namespace }: Props) {
  const { statuses, submitIO, lastIOResult } = useSimulatorStore();
  const status = statuses[namespace];
  const running = status?.running ?? false;

  return (
    <div className="p-4 rounded-xl border border-nvme-border bg-nvme-surface">
      <h3 className="font-mono text-sm font-semibold text-nvme-cyan tracking-wide mb-4">
        IO 命令提交
      </h3>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => submitIO(namespace)}
          disabled={!running}
          className={`flex items-center gap-2 px-6 py-3 font-mono text-sm font-semibold rounded-lg transition-all duration-200 ${
            running
              ? 'text-nvme-bg bg-nvme-cyan hover:bg-nvme-cyanDim shadow-[0_0_20px_rgba(0,229,255,0.4)] active:scale-95'
              : 'text-nvme-textMuted bg-nvme-surfaceLight cursor-not-allowed border border-nvme-border'
          }`}
        >
          <Send className="w-4 h-4" />
          提交 IO 命令
        </button>

        {lastIOResult && (
          <div
            className={`w-full p-3 rounded-lg border text-center transition-all duration-300 ${
              lastIOResult.success
                ? 'border-nvme-green/30 bg-nvme-green/5 text-nvme-green'
                : 'border-nvme-red/30 bg-nvme-red/5 text-nvme-red'
            }`}
          >
            <p className="font-mono text-xs">
              {lastIOResult.success
                ? `✓ 命令已接受 [${lastIOResult.id.slice(0, 8)}] in-flight:${lastIOResult.inFlight ?? 0}`
                : `✗ ${lastIOResult.errorMessage}`}
            </p>
          </div>
        )}

        {!running && (
          <p className="text-xs font-mono text-nvme-textMuted">
            请先启动模拟器
          </p>
        )}
      </div>
    </div>
  );
}
