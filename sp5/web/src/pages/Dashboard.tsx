import { useSimulatorStore } from '@/store/simulatorStore';
import { ControlBar } from '@/components/ControlBar';
import { WindowConfig } from '@/components/WindowConfig';
import { WindowStatus } from '@/components/WindowStatus';
import { IOSubmitPanel } from '@/components/IOSubmitPanel';
import { StatsPanel } from '@/components/StatsPanel';
import { Timeline } from '@/components/Timeline';
import { UtilizationPanel } from '@/components/UtilizationPanel';

export function Dashboard() {
  const { init, selectedNS, statuses } = useSimulatorStore();
  const status = statuses[selectedNS];
  const running = status?.running ?? false;
  const cyclePos = status?.cyclePositionMs ?? 0;
  const cycleMs = status?.cycleMs || 10000;

  const progressPercent = running ? ((cyclePos / cycleMs) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-nvme-bg text-nvme-text font-sans">
      <ControlBar />

      <div className="px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-1.5 rounded-full bg-nvme-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-nvme-cyan to-nvme-green transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono text-nvme-textMuted">{progressPercent}%</span>
        </div>

        <Timeline namespace={selectedNS} />
      </div>

      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <WindowConfig namespace={selectedNS} />
          <UtilizationPanel namespace={selectedNS} />
        </div>
        <div className="space-y-4">
          <WindowStatus namespace={selectedNS} />
          <IOSubmitPanel namespace={selectedNS} />
        </div>
        <div className="space-y-4">
          <StatsPanel namespace={selectedNS} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
