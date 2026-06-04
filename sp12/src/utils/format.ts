export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'text-gray-400',
    queued: 'text-yellow-400',
    processing: 'text-cyan-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
    cancelled: 'text-orange-400',
  };
  return colors[status] || 'text-gray-400';
};

export const getStatusBgColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-gray-500/20 border-gray-500/30',
    queued: 'bg-yellow-500/20 border-yellow-500/30',
    processing: 'bg-cyan-500/20 border-cyan-500/30',
    completed: 'bg-emerald-500/20 border-emerald-500/30',
    failed: 'bg-red-500/20 border-red-500/30',
    cancelled: 'bg-orange-500/20 border-orange-500/30',
  };
  return colors[status] || 'bg-gray-500/20 border-gray-500/30';
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: '等待中',
    queued: '队列中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return labels[status] || status;
};
