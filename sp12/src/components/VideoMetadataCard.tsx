import { Film, Clock, Monitor, HardDrive, FileVideo } from 'lucide-react';
import type { VideoMetadata } from '../../shared/types.js';
import { formatFileSize, formatDuration } from '../utils/format.js';

interface VideoMetadataCardProps {
  metadata: VideoMetadata | null;
  loading?: boolean;
}

export const VideoMetadataCard = ({ metadata, loading }: VideoMetadataCardProps) => {
  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-700/50 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!metadata) {
    return null;
  }

  const items = [
    {
      icon: FileVideo,
      label: '文件名',
      value: metadata.name,
    },
    {
      icon: HardDrive,
      label: '文件大小',
      value: formatFileSize(metadata.size),
    },
    {
      icon: Clock,
      label: '时长',
      value: formatDuration(metadata.duration),
    },
    {
      icon: Monitor,
      label: '分辨率',
      value: `${metadata.width} × ${metadata.height}`,
    },
    {
      icon: Film,
      label: '编码',
      value: metadata.codec,
    },
  ];

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/30">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Film className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-100">视频信息</h3>
          <p className="text-sm text-slate-400">已成功解析视频元数据</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30"
          >
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <item.icon className="w-4 h-4" />
              <span className="text-xs">{item.label}</span>
            </div>
            <p className="text-slate-100 font-medium truncate" title={item.value}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
