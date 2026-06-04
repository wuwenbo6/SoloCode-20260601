import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStateColor(state: string): string {
  switch (state) {
    case 'idle':
      return 'text-gray-500';
    case 'printing':
      return 'text-green-500';
    case 'paused':
      return 'text-yellow-500';
    case 'homing':
      return 'text-blue-500';
    case 'heating':
      return 'text-orange-500';
    case 'busy':
      return 'text-purple-500';
    default:
      return 'text-gray-500';
  }
}

export function getStateBgColor(state: string): string {
  switch (state) {
    case 'idle':
      return 'bg-gray-100 text-gray-800';
    case 'printing':
      return 'bg-green-100 text-green-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'homing':
      return 'bg-blue-100 text-blue-800';
    case 'heating':
      return 'bg-orange-100 text-orange-800';
    case 'busy':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStateLabel(state: string): string {
  const labels: Record<string, string> = {
    idle: '空闲',
    printing: '打印中',
    paused: '已暂停',
    homing: '回零中',
    heating: '加热中',
    busy: '忙碌',
  };
  return labels[state] || state;
}
