import axios from 'axios';
import type {
  Process,
  CLOSGroup,
  SystemMetrics,
  SystemConfig,
  SimulatorStatus,
  MetricsHistory,
  RMIDStats,
  CATAllocation,
  CreateProcessRequest,
  UpdateProcessRequest,
  CreateCLOSRequest,
  UpdateCLOSRequest,
} from '../types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
});

export const systemApi = {
  getMetrics: (): Promise<SystemMetrics> =>
    api.get('/system/metrics').then((r) => r.data),

  getConfig: (): Promise<SystemConfig> =>
    api.get('/system/config').then((r) => r.data),

  updateConfig: (config: Partial<SystemConfig>): Promise<SystemConfig> =>
    api.put('/system/config', config).then((r) => r.data),
};

export const processApi = {
  getAll: (): Promise<Process[]> =>
    api.get('/processes').then((r) => r.data),

  create: (req: CreateProcessRequest): Promise<Process> =>
    api.post('/processes', req).then((r) => r.data),

  get: (pid: number): Promise<Process> =>
    api.get(`/processes/${pid}`).then((r) => r.data),

  update: (pid: number, req: UpdateProcessRequest): Promise<Process> =>
    api.put(`/processes/${pid}`, req).then((r) => r.data),

  remove: (pid: number): Promise<void> =>
    api.delete(`/processes/${pid}`).then((r) => r.data),

  getHistory: (pid: number, duration = '5m'): Promise<MetricsHistory[]> =>
    api.get(`/processes/${pid}/history?duration=${duration}`).then((r) => r.data),
};

export const closApi = {
  getAll: (): Promise<CLOSGroup[]> =>
    api.get('/clos').then((r) => r.data),

  create: (req: CreateCLOSRequest): Promise<CLOSGroup> =>
    api.post('/clos', req).then((r) => r.data),

  update: (id: number, req: UpdateCLOSRequest): Promise<CLOSGroup> =>
    api.put(`/clos/${id}`, req).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/clos/${id}`).then((r) => r.data),
};

export const simulatorApi = {
  getStatus: (): Promise<SimulatorStatus> =>
    api.get('/simulator/status').then((r) => r.data),

  start: (): Promise<SimulatorStatus> =>
    api.post('/simulator/start').then((r) => r.data),

  stop: (): Promise<SimulatorStatus> =>
    api.post('/simulator/stop').then((r) => r.data),
};

export const rmidApi = {
  getStats: (): Promise<RMIDStats[]> =>
    api.get('/rmid/stats').then((r) => r.data),
};

export const catApi = {
  getAllocations: (): Promise<CATAllocation[]> =>
    api.get('/cat/allocations').then((r) => r.data),
};

export default api;
