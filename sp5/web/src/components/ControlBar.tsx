import { useSimulatorStore } from '@/store/simulatorStore';
import { Play, Square, Wifi, WifiOff, FileText, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export function ControlBar() {
  const { namespaces, selectedNS, setSelectedNS, start, stop, connected, createNS, deleteNS } = useSimulatorStore();
  const statuses = useSimulatorStore((s) => s.statuses);
  const running = statuses[selectedNS]?.running ?? false;
  const [newNSName, setNewNSName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = () => {
    if (newNSName.trim()) {
      createNS(newNSName.trim());
      setNewNSName('');
      setShowCreate(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-nvme-border bg-nvme-surface/50 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <h1 className="font-mono text-lg font-bold text-nvme-cyan tracking-wider">
          NVMe IO Determinism
        </h1>
        <span className="px-2 py-0.5 text-xs font-mono rounded border border-nvme-border text-nvme-textDim">
          SIMULATOR
        </span>
        <div className="flex items-center gap-1 ml-4">
          {namespaces.map((ns) => (
            <div key={ns} className="flex items-center">
              <button
                onClick={() => setSelectedNS(ns)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-all ${
                  selectedNS === ns
                    ? 'text-nvme-cyan border-nvme-cyan/30 bg-nvme-cyan/10'
                    : 'text-nvme-textDim border-nvme-border hover:border-nvme-cyan/50 hover:text-nvme-cyan'
                }`}
              >
                {ns}
                {statuses[ns]?.running && (
                  <span className="ml-1.5 w-1.5 h-1.5 inline-block rounded-full bg-nvme-green animate-pulse" />
                )}
              </button>
              {ns !== 'ns0' && (
                <button
                  onClick={() => deleteNS(ns)}
                  className="ml-0.5 p-0.5 text-nvme-red/50 hover:text-nvme-red transition-colors"
                  title={`删除 ${ns}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {showCreate ? (
            <div className="flex items-center gap-1 ml-2">
              <input
                type="text"
                value={newNSName}
                onChange={(e) => setNewNSName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="ns名称"
                className="w-20 px-2 py-1 text-xs font-mono text-nvme-text bg-nvme-bg border border-nvme-border rounded focus:border-nvme-cyan focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleCreate}
                className="p-1 text-nvme-green hover:text-nvme-greenDim transition-colors"
              >
                ✓
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 text-nvme-textMuted hover:text-nvme-text transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="ml-2 flex items-center gap-1 px-2 py-1 text-xs font-mono text-nvme-textDim border border-dashed border-nvme-border rounded-md hover:border-nvme-cyan hover:text-nvme-cyan transition-all"
            >
              <Plus className="w-3 h-3" />
              NS
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link
          to="/logs"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-nvme-textDim border border-nvme-border rounded-md hover:border-nvme-cyan hover:text-nvme-cyan transition-all"
        >
          <FileText className="w-3.5 h-3.5" />
          日志
        </Link>

        <div className="flex items-center gap-2 text-xs font-mono text-nvme-textDim">
          {connected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-nvme-green" />
              <span className="text-nvme-green">WS</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-nvme-red" />
              <span className="text-nvme-red">WS</span>
            </>
          )}
        </div>

        {running ? (
          <button
            onClick={() => stop(selectedNS)}
            className="flex items-center gap-2 px-4 py-2 font-mono text-sm font-medium text-nvme-red border border-nvme-red/30 rounded-lg bg-nvme-red/10 hover:bg-nvme-red/20 transition-all duration-200"
          >
            <Square className="w-3.5 h-3.5" />
            停止 {selectedNS}
          </button>
        ) : (
          <button
            onClick={() => start(selectedNS)}
            className="flex items-center gap-2 px-4 py-2 font-mono text-sm font-medium text-nvme-cyan border border-nvme-cyan/30 rounded-lg bg-nvme-cyan/10 hover:bg-nvme-cyan/20 transition-all duration-200"
          >
            <Play className="w-3.5 h-3.5" />
            启动 {selectedNS}
          </button>
        )}
      </div>
    </div>
  );
}
