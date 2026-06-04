import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Thermometer, Power, PowerOff } from 'lucide-react';
import BeaconPanel from '@/components/BeaconPanel';
import IndoorMap from '@/components/IndoorMap';
import NavigationCard from '@/components/NavigationCard';
import usePositionStore from '@/store/usePositionStore';

export default function Home() {
  const fetchBeacons = usePositionStore((s) => s.fetchBeacons);
  const fetchPathGraph = usePositionStore((s) => s.fetchPathGraph);
  const fetchFloors = usePositionStore((s) => s.fetchFloors);
  const wsConnected = usePositionStore((s) => s.wsConnected);
  const connectWS = usePositionStore((s) => s.connectWS);
  const disconnectWS = usePositionStore((s) => s.disconnectWS);
  const showHeatmap = usePositionStore((s) => s.showHeatmap);
  const toggleHeatmap = usePositionStore((s) => s.toggleHeatmap);
  const remoteUsers = usePositionStore((s) => s.remoteUsers);

  useEffect(() => {
    fetchFloors();
    fetchBeacons();
    fetchPathGraph();
  }, [fetchFloors, fetchBeacons, fetchPathGraph]);

  return (
    <div className="h-screen bg-[#0a1628] flex flex-col">
      <header className="h-14 bg-[#0d1f3c] border-b border-[#1e3a5f] flex items-center px-4 shrink-0">
        <h1 className="text-[#00D4FF] font-['Orbitron'] text-lg tracking-wider">
          IndoorNav
        </h1>
        <nav className="ml-8 flex gap-4">
          <Link to="/" className="text-[#00D4FF] text-sm hover:underline">
            定位大厅
          </Link>
          <Link to="/beacons" className="text-gray-400 text-sm hover:text-white transition-colors">
            信标管理
          </Link>
          <Link to="/paths" className="text-gray-400 text-sm hover:text-white transition-colors">
            路径编辑
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleHeatmap}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showHeatmap
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                : 'bg-[#0d1f3c] text-gray-400 border border-[#1e3a5f] hover:border-orange-500/30'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            热力图
          </button>

          <button
            onClick={wsConnected ? disconnectWS : connectWS}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              wsConnected
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-[#0d1f3c] text-gray-400 border border-[#1e3a5f] hover:border-green-500/30'
            }`}
          >
            {wsConnected ? (
              <>
                <Power className="w-3.5 h-3.5" />
                <Users className="w-3.5 h-3.5" />
                {remoteUsers.length + 1}
              </>
            ) : (
              <>
                <PowerOff className="w-3.5 h-3.5" />
                位置共享
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <BeaconPanel />
        <div className="flex-1 p-4 relative">
          <IndoorMap />
          <NavigationCard />
        </div>
      </div>
    </div>
  );
}
