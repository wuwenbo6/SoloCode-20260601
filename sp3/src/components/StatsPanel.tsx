import { TrendingDown, Database, Gauge, Zap, GitBranch, Layers } from 'lucide-react';
import type { CompressionResult } from '@shared/types';
import { cn } from '../lib/utils';

interface StatsPanelProps {
  result: CompressionResult | null;
}

export default function StatsPanel({ result }: StatsPanelProps) {
  if (!result) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-4 w-24 bg-dark-600 rounded mb-3" />
            <div className="h-8 w-20 bg-dark-600 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const info = result.compressionInfo;
  const numGroups = info?.num_groups || 1;
  const branchPoints = info?.branch_points || [];
  const sidsAtBranch = info?.sids_at_branch || 0;
  const sidsCompressed = info?.sids_compressed || 0;
  
  const stats = [
    {
      label: '原始长度',
      value: `${result.originalTotalLength}`,
      unit: '字节',
      icon: Database,
      color: 'text-primary-400',
      bgColor: 'bg-primary-500/20',
      subtext: `${result.originalSids.length} × 16 字节`,
    },
    {
      label: '压缩后长度',
      value: `${result.compressedTotalLength}`,
      unit: '字节',
      icon: Zap,
      color: 'text-accent',
      bgColor: 'bg-accent/20',
      subtext: `${result.compressedSids.length} 个 SID`,
    },
    {
      label: '节省字节',
      value: `${result.bytesSaved > 0 ? result.bytesSaved : 0}`,
      unit: '字节',
      icon: TrendingDown,
      color: result.bytesSaved > 0 ? 'text-accent' : 'text-warning',
      bgColor: result.bytesSaved > 0 ? 'bg-accent/20' : 'bg-warning/20',
      subtext: result.bytesSaved > 0 ? '空间节省' : '无优化',
    },
    {
      label: '压缩率',
      value: `${result.compressionRatio > 0 ? result.compressionRatio : 0}`,
      unit: '%',
      icon: Gauge,
      color: result.compressionRatio > 0 ? 'text-accent' : 'text-warning',
      bgColor: result.compressionRatio > 0 ? 'bg-accent/20' : 'bg-warning/20',
      subtext: result.compressionMethod,
    },
  ];
  
  const extraStats = [
    {
      label: '路径分组',
      value: `${numGroups}`,
      unit: '组',
      icon: Layers,
      color: 'text-primary-400',
      bgColor: 'bg-primary-500/20',
      subtext: `共 ${result.compressedSids.length} 个 SID`,
    },
    {
      label: '分支节点',
      value: `${sidsAtBranch}`,
      unit: '个',
      icon: GitBranch,
      color: 'text-warning',
      bgColor: 'bg-warning/20',
      subtext: branchPoints.length > 0 ? `分支点: [${branchPoints.join(', ')}]` : '无分支',
    },
    {
      label: '已压缩',
      value: `${sidsCompressed}`,
      unit: '个',
      icon: Zap,
      color: 'text-accent',
      bgColor: 'bg-accent/20',
      subtext: `前缀: ${info?.prefix_hextets || 0} hextets`,
    },
    {
      label: '压缩深度',
      value: `${info?.max_compression_depth || 8}`,
      unit: '层',
      icon: Gauge,
      color: 'text-primary-400',
      bgColor: 'bg-primary-500/20',
      subtext: info?.preserve_branches ? '保留分支' : '强制压缩',
    },
  ];

  const allStats = [...stats, ...extraStats];
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={stat.label} 
            className="stat-card animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <span className="text-xs text-gray-500">{stat.unit}</span>
            </div>
            <div className="animate-number-roll">
              <span className={cn("text-3xl font-bold font-mono", stat.color)}>
                {stat.value}
              </span>
              <span className="text-lg text-gray-500 ml-1">{stat.unit}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-gray-300">{stat.label}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
          </div>
        ))}
      </div>
      
      {result.compressionMethod.includes('Prefix') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          {extraStats.map((stat, index) => (
            <div 
              key={stat.label} 
              className="stat-card animate-slide-up"
              style={{ animationDelay: `${(index + 4) * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
                <span className="text-xs text-gray-500">{stat.unit}</span>
              </div>
              <div className="animate-number-roll">
                <span className={cn("text-2xl font-bold font-mono", stat.color)}>
                  {stat.value}
                </span>
                <span className="text-sm text-gray-500 ml-1">{stat.unit}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-gray-300">{stat.label}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
