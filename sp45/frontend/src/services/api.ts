import axios from 'axios';
import type {
  PrinterStatus,
  FirmwareInfo,
  ConnectionStatus,
  AxisMove,
  PrintHistoryResponse,
  VideoStreamInfo,
  FirmwareProgress,
} from '../types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export const printerAPI = {
  getStatus: (): Promise<PrinterStatus> =>
    api.get('/status').then((r) => r.data),

  getFirmwareInfo: (): Promise<FirmwareInfo> =>
    api.get('/firmware-info').then((r) => r.data),

  getConnectionStatus: (): Promise<ConnectionStatus> =>
    api.get('/connection').then((r) => r.data),

  connect: (type: 'simulator' | 'webusb' | 'serial'): Promise<ConnectionStatus> =>
    api.post('/connect', { type }).then((r) => r.data),

  disconnect: (): Promise<{ connected: boolean }> =>
    api.post('/disconnect').then((r) => r.data),

  setAutoReconnect: (enabled: boolean): Promise<{ status: string; autoReconnect: boolean }> =>
    api.post('/auto-reconnect', { enabled }).then((r) => r.data),

  sendCommand: (command: string): Promise<{ response: string }> =>
    api.post('/command', { command }).then((r) => r.data),

  pausePrint: (): Promise<{ status: string }> =>
    api.post('/control/pause').then((r) => r.data),

  resumePrint: (): Promise<{ status: string }> =>
    api.post('/control/resume').then((r) => r.data),

  stopPrint: (): Promise<{ status: string }> =>
    api.post('/control/stop').then((r) => r.data),

  moveAxis: (move: AxisMove): Promise<{ status: string }> =>
    api.post('/control/move', move).then((r) => r.data),

  homeAxis: (axis: string): Promise<{ status: string }> =>
    api.post('/control/home', { axis }).then((r) => r.data),

  setTemperature: (heater: string, temp: number): Promise<{ status: string }> =>
    api.post('/control/temperature', { heater, temp }).then((r) => r.data),

  startPrintJob: (fileName: string, fileSize?: number): Promise<{ job_id: number; status: string }> =>
    api.post('/control/start-print', { file_name: fileName, file_size: fileSize || 0 }).then((r) => r.data),
};

export const videoAPI = {
  getInfo: (): Promise<VideoStreamInfo> =>
    api.get('/video/info').then((r) => r.data),

  startStream: (): Promise<{ status: string }> =>
    api.post('/video/start').then((r) => r.data),

  stopStream: (): Promise<{ status: string }> =>
    api.post('/video/stop').then((r) => r.data),
};

export const firmwareAPI = {
  upload: (file: File): Promise<{ size: number; content: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/firmware/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  startUpgrade: (hexContent: string): Promise<{ status: string }> =>
    api.post('/firmware/start', { hex_content: hexContent }).then((r) => r.data),

  pauseUpgrade: (): Promise<{ status: string }> =>
    api.post('/firmware/pause').then((r) => r.data),

  resumeUpgrade: (hexContent?: string): Promise<{ status: string }> =>
    api.post('/firmware/resume', { hex_content: hexContent || '' }).then((r) => r.data),

  resetUpgrade: (): Promise<{ status: string }> =>
    api.post('/firmware/reset').then((r) => r.data),

  getProgress: (): Promise<FirmwareProgress> =>
    api.get('/firmware/progress').then((r) => r.data),

  cancel: (): Promise<{ status: string }> =>
    api.post('/firmware/cancel').then((r) => r.data),
};

export const historyAPI = {
  getAll: (limit = 20, offset = 0): Promise<PrintHistoryResponse> =>
    api.get('/history', { params: { limit, offset } }).then((r) => r.data),

  getById: (id: number): Promise<PrintHistoryResponse> =>
    api.get(`/history/${id}`).then((r) => r.data),

  delete: (id: number): Promise<{ status: string }> =>
    api.delete(`/history/${id}`).then((r) => r.data),
};

export const createWebSocket = (path: string): WebSocket => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return new WebSocket(`${protocol}//${host}${path}`);
};
