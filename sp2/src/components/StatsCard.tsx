import type { ReactNode } from 'react';
import { Activity, Network, FileCode, Database, Radio } from 'lucide-react';
import { useStore } from '@/hooks/useStore';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  gradient: string;
  glowClass?: string;
}

function StatsCardInner({ title, value, icon, gradient, glowClass }: StatsCardProps) {
  return (
    <div className={`gradient-border p-5 ${glowClass || ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-400">{title}</span>
        <div className={`w-9 h-9 rounded-lg ${gradient} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="font-mono text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

export function StatsCards() {
  const stats = useStore((s) => s.stats);
  const wsConnected = useStore((s) => s.wsConnected);

  const cards = [
    {
      title: '接收数据包',
      value: stats.packets.toLocaleString(),
      icon: <Activity className="w-5 h-5 text-white" />,
      gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600',
      glowClass: 'glow-cyan',
    },
    {
      title: '活跃模板',
      value: stats.templates,
      icon: <FileCode className="w-5 h-5 text-white" />,
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
    },
    {
      title: '观测点',
      value: stats.observers,
      icon: <Network className="w-5 h-5 text-white" />,
      gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
      glowClass: 'glow-amber',
    },
    {
      title: '流记录',
      value: stats.flows.toLocaleString(),
      icon: <Database className="w-5 h-5 text-white" />,
      gradient: 'bg-gradient-to-br from-emerald-500 to-green-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <StatsCardInner key={card.title} {...card} />
      ))}
      <div className="gradient-border p-3 flex items-center gap-2">
        <Radio className={`w-4 h-4 ${wsConnected ? 'text-emerald-400 animate-pulse-glow' : 'text-red-400'}`} />
        <span className={`text-sm ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
          WebSocket {wsConnected ? '已连接' : '未连接'}
        </span>
      </div>
    </div>
  );
}
