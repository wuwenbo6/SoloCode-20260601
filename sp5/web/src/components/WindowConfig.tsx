import { useSimulatorStore } from '@/store/simulatorStore';
import { Plus, Trash2, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { IOWindow, SimulatorConfig } from '@/utils/api';

interface Props {
  namespace: string;
}

export function WindowConfig({ namespace }: Props) {
  const { setConfig, statuses } = useSimulatorStore();
  const status = statuses[namespace];
  const [windows, setWindows] = useState<IOWindow[]>([]);
  const [cycleMs, setCycleMs] = useState(10000);
  const [autoInterval, setAutoInterval] = useState(500);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (status) {
      setWindows(status.windows.map((w) => ({ ...w })));
      setCycleMs(status.cycleMs);
      setAutoInterval(autoInterval);
      setDirty(false);
    }
  }, [status?.windows, status?.cycleMs]);

  const addWindow = () => {
    const maxEnd = windows.reduce((max, w) => {
      return Math.max(max, w.startOffsetMs + w.durationMs);
    }, 0);
    setWindows([
      ...windows,
      {
        id: '',
        startOffsetMs: Math.min(maxEnd, cycleMs - 1000),
        durationMs: 1000,
      },
    ]);
    setDirty(true);
  };

  const removeWindow = (index: number) => {
    setWindows(windows.filter((_, i) => i !== index));
    setDirty(true);
  };

  const updateWindow = (index: number, field: keyof IOWindow, value: number) => {
    const updated = [...windows];
    updated[index] = { ...updated[index], [field]: value };
    setWindows(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    const config: SimulatorConfig = {
      cycleMs,
      windows,
      autoSubmitIntervalMs: autoInterval,
    };
    await setConfig(namespace, config);
    setDirty(false);
  };

  return (
    <div className="p-4 rounded-xl border border-nvme-border bg-nvme-surface">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-sm font-semibold text-nvme-cyan tracking-wide">
          IO 窗口配置
        </h3>
        {dirty && (
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-nvme-cyan border border-nvme-cyan/30 rounded-md bg-nvme-cyan/10 hover:bg-nvme-cyan/20 transition-all"
          >
            <Save className="w-3 h-3" />
            保存
          </button>
        )}
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-mono text-nvme-textDim w-24">周期 (ms)</label>
          <input
            type="number"
            value={cycleMs}
            onChange={(e) => {
              setCycleMs(Number(e.target.value));
              setDirty(true);
            }}
            className="flex-1 px-3 py-1.5 text-sm font-mono text-nvme-text bg-nvme-bg border border-nvme-border rounded-md focus:border-nvme-cyan focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-mono text-nvme-textDim w-24">自动间隔 (ms)</label>
          <input
            type="number"
            value={autoInterval}
            onChange={(e) => {
              setAutoInterval(Number(e.target.value));
              setDirty(true);
            }}
            className="flex-1 px-3 py-1.5 text-sm font-mono text-nvme-text bg-nvme-bg border border-nvme-border rounded-md focus:border-nvme-cyan focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {windows.map((w, i) => (
          <div
            key={w.id || i}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-nvme-bg border border-nvme-border/50"
          >
            <span className="text-xs font-mono text-nvme-textMuted w-4">{i + 1}</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-mono text-nvme-textMuted">起始</label>
                <input
                  type="number"
                  value={w.startOffsetMs}
                  onChange={(e) => updateWindow(i, 'startOffsetMs', Number(e.target.value))}
                  className="w-20 px-2 py-1 text-xs font-mono text-nvme-text bg-nvme-surface border border-nvme-border/50 rounded focus:border-nvme-cyan focus:outline-none transition-colors"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-mono text-nvme-textMuted">时长</label>
                <input
                  type="number"
                  value={w.durationMs}
                  onChange={(e) => updateWindow(i, 'durationMs', Number(e.target.value))}
                  className="w-20 px-2 py-1 text-xs font-mono text-nvme-text bg-nvme-surface border border-nvme-border/50 rounded focus:border-nvme-cyan focus:outline-none transition-colors"
                />
              </div>
            </div>
            <button
              onClick={() => removeWindow(i)}
              className="p-1 text-nvme-red/50 hover:text-nvme-red transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addWindow}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-nvme-textDim border border-dashed border-nvme-border rounded-md hover:border-nvme-cyan hover:text-nvme-cyan transition-all w-full justify-center"
      >
        <Plus className="w-3 h-3" />
        添加窗口
      </button>
    </div>
  );
}
