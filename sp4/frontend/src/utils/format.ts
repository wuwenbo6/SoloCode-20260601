export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes.toFixed(1)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const formatBandwidth = (mbps: number): string => {
  if (mbps < 1000) return `${mbps.toFixed(1)} MB/s`;
  return `${(mbps / 1000).toFixed(2)} GB/s`;
};

export const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

export const formatNumber = (num: number, decimals = 1): string => {
  return num.toFixed(decimals);
};

export const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getCLOSColor = (closId: number, closGroups: Array<{ id: number; color: string }>): string => {
  const group = closGroups.find((g) => g.id === closId);
  return group?.color || '#00E5FF';
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'running':
      return '#4CAF50';
    case 'paused':
      return '#FF9800';
    case 'stopped':
      return '#F44336';
    default:
      return '#B2BAC2';
  }
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};
