import { StatsCards } from '@/components/StatsCard';
import { ObserverTable } from '@/components/ObserverTable';
import { TrafficChart } from '@/components/TrafficChart';

export default function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">NetFlow v9 收集器</h1>
        <p className="text-slate-400 text-sm">实时监控网络流量，动态管理模板定义</p>
      </div>

      <StatsCards />
      <TrafficChart />
      <ObserverTable />
    </div>
  );
}
