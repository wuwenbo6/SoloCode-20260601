import { Layers, CheckCircle, Hash, GitBranch, Layers as LayersIcon } from 'lucide-react';
import type { SID } from '@shared/types';
import { cn } from '../lib/utils';

interface SidListProps {
  title: string;
  sids: SID[];
  totalLength: number;
  isCompressed?: boolean;
  sharedPrefix?: string;
  compressionInfo?: any;
}

export default function SidList({ 
  title, 
  sids, 
  totalLength, 
  isCompressed = false,
  sharedPrefix,
  compressionInfo
}: SidListProps) {
  type SIDWithMeta = SID & { originalIndex: number; group_index?: number };
  
  const groupSidsByGroupIndex = (sidList: SID[]) => {
    const groups: { [key: number]: SIDWithMeta[] } = {};
    sidList.forEach((sid, index) => {
      const groupIndex = sid.group_index ?? 0;
      if (!groups[groupIndex]) {
        groups[groupIndex] = [];
      }
      groups[groupIndex].push({ ...sid, originalIndex: index });
    });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  };

  const groups: [string, SIDWithMeta[]][] | null = isCompressed && compressionInfo?.preserve_branches 
    ? groupSidsByGroupIndex(sids) 
    : null;

  const isBranchNode = (sid: SID, originalIndex: number) => {
    if (!compressionInfo?.preserve_branches) return false;
    return !sid.compressed;
  };

  const renderSidItem = (sid: SIDWithMeta | SID, originalIndex: number, inGroup: boolean = false) => {
    const isBranch = isBranchNode(sid, originalIndex);
    
    return (
      <div
        key={originalIndex}
        className={cn(
          "group sid-item",
          isCompressed && sid.compressed && "compressed",
          isBranch && "ring-2 ring-warning/50 bg-warning/5"
        )}
        style={{ animationDelay: `${originalIndex * 0.05}s` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                "text-xs font-mono px-2 py-0.5 rounded-md",
                isCompressed && sid.compressed 
                  ? "bg-accent/20 text-accent" 
                  : isBranch
                    ? "bg-warning/20 text-warning"
                    : "bg-dark-500 text-gray-300"
              )}>
                SID [{originalIndex}]
              </span>
              <span className="text-xs font-medium text-primary-400">
                {sid.function}
              </span>
              {isBranch && (
                <span className="flex items-center gap-1 text-xs text-warning">
                  <GitBranch className="w-3 h-3" />
                  分支节点
                </span>
              )}
              {isCompressed && sid.compressed && (
                <span className="text-xs text-accent">✓ 前缀压缩</span>
              )}
            </div>
            <code className={cn(
              "block text-sm font-mono break-all",
              isCompressed && sid.compressed 
                ? "text-accent-100" 
                : isBranch
                  ? "text-warning"
                  : "text-gray-200"
            )}>
              {sid.address}
            </code>
            {sid.full_address && sid.address !== sid.full_address && (
              <code className="block text-xs font-mono text-gray-500 mt-1 break-all">
                → {sid.full_address}
              </code>
            )}
            <p className="mt-2 text-xs text-gray-400">
              {sid.description}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-gray-500">16 字节</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card glass-card-hover p-6 animate-slide-up" style={{ animationDelay: isCompressed ? '0.1s' : '0s' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isCompressed ? "bg-accent/20" : "bg-primary-500/20"
          )}>
            <Layers className={cn("w-5 h-5", isCompressed ? "text-accent" : "text-primary-400")} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-sm text-gray-400">
              {sids.length} 个 SID · {totalLength} 字节
              {compressionInfo?.num_groups > 1 && ` · ${compressionInfo.num_groups} 个路径组`}
            </p>
          </div>
        </div>
        {isCompressed && sharedPrefix && (
          <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-full border border-accent/30">
            <CheckCircle className="w-4 h-4 text-accent" />
            <span className="text-xs font-medium text-accent">已压缩</span>
          </div>
        )}
      </div>

      {isCompressed && sharedPrefix && (
        <div className="mb-4 p-3 bg-dark-700/50 rounded-xl border border-dark-500">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-warning" />
            <span className="text-xs font-medium text-warning">共享前缀</span>
          </div>
          <code className="block text-sm font-mono text-warning break-all">
            {sharedPrefix}
          </code>
        </div>
      )}

      {isCompressed && compressionInfo?.group_details && (
        <div className="mb-4 p-3 bg-primary-500/10 rounded-xl border border-primary-500/30">
          <div className="flex items-center gap-2 mb-2">
            <LayersIcon className="w-4 h-4 text-primary-400" />
            <span className="text-xs font-medium text-primary-400">
              路径分组详情 ({compressionInfo.group_details.length} 组)
            </span>
          </div>
          <div className="space-y-2">
            {compressionInfo.group_details.map((group: any) => (
              <div key={group.group_index} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  组 {group.group_index}: {group.group_size} 个 SID
                </span>
                <span className="font-mono text-primary-300">
                  {group.prefix_hextets} hextets · 压缩 {group.sids_compressed} 个
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
        {groups ? (
          groups.map(([groupIndex, groupSids]) => (
            <div key={groupIndex} className="mb-4 last:mb-0">
              {groups.length > 1 && (
                <div className="flex items-center gap-2 mb-2 px-2">
                  <div className="h-px flex-1 bg-dark-600" />
                  <span className="text-xs font-medium text-primary-400 px-2">
                    路径组 {groupIndex}
                  </span>
                  <div className="h-px flex-1 bg-dark-600" />
                </div>
              )}
              <div className="space-y-2">
                {groupSids.map((sid) => renderSidItem(sid, sid.originalIndex, true))}
              </div>
            </div>
          ))
        ) : (
          sids.map((sid, index) => renderSidItem(sid, index))
        )}
      </div>

      {sids.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无 SID 数据</p>
          <p className="text-sm mt-1">点击"开始模拟"生成结果</p>
        </div>
      )}
    </div>
  );
}
