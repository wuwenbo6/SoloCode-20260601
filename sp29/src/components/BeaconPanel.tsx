import { Radar, Play, Square, Wifi, WifiOff } from 'lucide-react';
import usePositionStore from '@/store/usePositionStore';

function rssiColor(rssi: number | null): string {
  if (rssi === null) return '#6b7280';
  if (rssi > -50) return '#22c55e';
  if (rssi > -70) return '#eab308';
  return '#ef4444';
}

function rssiBarWidth(rssi: number | null): number {
  if (rssi === null) return 0;
  const pct = Math.max(0, Math.min(100, ((rssi + 100) / 70) * 100));
  return pct;
}

export default function BeaconPanel() {
  const beacons = usePositionStore((s) => s.beacons);
  const isScanning = usePositionStore((s) => s.isScanning);
  const simulationMode = usePositionStore((s) => s.simulationMode);
  const position = usePositionStore((s) => s.position);
  const startScan = usePositionStore((s) => s.startScan);
  const stopScan = usePositionStore((s) => s.stopScan);
  const startSimulation = usePositionStore((s) => s.startSimulation);
  const stopSimulation = usePositionStore((s) => s.stopSimulation);

  const handleToggleScan = () => {
    if (isScanning) {
      if (simulationMode) {
        stopSimulation();
      } else {
        stopScan();
      }
    } else {
      if (simulationMode) {
        startSimulation();
      } else {
        startScan();
      }
    }
  };

  return (
    <div className="w-80 flex flex-col bg-[#0a1628]/80 backdrop-blur-md border-r border-[#1e3a5f] overflow-y-auto">
      <div className="p-4 border-b border-[#1e3a5f]">
        <div className="flex items-center gap-2 mb-4">
          <Radar className="w-5 h-5 text-[#00D4FF]" />
          <h2 className="text-[#00D4FF] font-bold text-base tracking-wide">BLE 信标扫描</h2>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              if (isScanning) {
                if (simulationMode) stopSimulation();
                else stopScan();
              }
              usePositionStore.setState({ simulationMode: false });
            }}
            className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
              !simulationMode
                ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/10'
                : 'border-[#1e3a5f] text-gray-400 hover:border-[#00D4FF]/50'
            }`}
          >
            <Wifi className="w-3 h-3 inline mr-1" />
            实时扫描
          </button>
          <button
            onClick={() => {
              if (isScanning && !simulationMode) stopScan();
              usePositionStore.setState({ simulationMode: true });
            }}
            className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
              simulationMode
                ? 'border-[#FF6B35] text-[#FF6B35] bg-[#FF6B35]/10'
                : 'border-[#1e3a5f] text-gray-400 hover:border-[#FF6B35]/50'
            }`}
          >
            <Radar className="w-3 h-3 inline mr-1" />
            模拟模式
          </button>
        </div>

        <button
          onClick={handleToggleScan}
          className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            isScanning
              ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
              : 'bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF] hover:bg-[#00D4FF]/30'
          }`}
        >
          {isScanning ? (
            <>
              <Square className="w-4 h-4" />
              停止扫描
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              开始扫描
            </>
          )}
        </button>

        {isScanning && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4FF] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4FF]" />
            </span>
            <span className="text-[#00D4FF] text-xs">
              {simulationMode ? '模拟扫描中...' : '实时扫描中...'}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {beacons.length === 0 && (
          <div className="text-gray-500 text-xs text-center py-8">
            <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
            未发现信标
          </div>
        )}
        {beacons.map((beacon) => (
          <div
            key={beacon.uuid}
            className="bg-[#0d1f3c] rounded-lg p-3 border border-[#1e3a5f]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-200">{beacon.name}</span>
              <span className="text-[10px] text-gray-500 font-mono">
                {beacon.uuid.slice(0, 8)}...
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs mb-2">
              <span style={{ color: rssiColor(beacon.rssi) }} className="font-mono">
                RSSI: {beacon.rssi !== null ? `${beacon.rssi} dBm` : '--'}
              </span>
              <span className="text-gray-400 font-mono">
                距离: {beacon.distance !== null ? `${beacon.distance.toFixed(2)}m` : '--'}
              </span>
            </div>

            <div className="w-full h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${rssiBarWidth(beacon.rssi)}%`,
                  backgroundColor: rssiColor(beacon.rssi),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-[#1e3a5f]">
        <div className="text-xs text-gray-500 mb-2">当前位置</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0d1f3c] rounded-md p-2 text-center border border-[#1e3a5f]">
            <div className="text-[10px] text-gray-500">X</div>
            <div className="text-sm font-mono text-[#00D4FF]">
              {position ? position.x.toFixed(1) : '--'}
            </div>
          </div>
          <div className="bg-[#0d1f3c] rounded-md p-2 text-center border border-[#1e3a5f]">
            <div className="text-[10px] text-gray-500">Y</div>
            <div className="text-sm font-mono text-[#00D4FF]">
              {position ? position.y.toFixed(1) : '--'}
            </div>
          </div>
          <div className="bg-[#0d1f3c] rounded-md p-2 text-center border border-[#1e3a5f]">
            <div className="text-[10px] text-gray-500">精度</div>
            <div className="text-sm font-mono text-[#00D4FF]">
              {position ? position.accuracy.toFixed(1) : '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
