import { api } from '@/lib/axios';
import type { 
  AssetLifecycleLog, 
  LifecycleLogQueryParams, 
  PaginatedResponse,
  ReportData,
  LifecycleAction,
  LocationData,
} from '../../shared/types';

interface CreateLogParams {
  assetUid: string;
  action: LifecycleAction;
  performedBy: string;
  location?: LocationData;
  note?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export const lifecycleService = {
  async createLog(params: CreateLogParams): Promise<void> {
    await api.post('/lifecycle', params);
  },

  async getLogs(params: LifecycleLogQueryParams = {}) {
    const { data } = await api.get<{
      success: boolean;
      data: PaginatedResponse<AssetLifecycleLog>;
    }>('/lifecycle', { params });
    return data.data;
  },

  async getLogsByAsset(uid: string, page = 1, limit = 50) {
    const { data } = await api.get<{
      success: boolean;
      data: PaginatedResponse<AssetLifecycleLog>;
    }>(`/lifecycle/asset/${uid}`, { params: { page, limit } });
    return data.data;
  },

  async getReport(startDate?: string, endDate?: string) {
    const { data } = await api.get<{
      success: boolean;
      data: ReportData;
    }>('/lifecycle/report', { params: { startDate, endDate } });
    return data.data;
  },

  async exportLogs(assetUid?: string, startDate?: string, endDate?: string) {
    const params: Record<string, string> = {};
    if (assetUid) params.assetUid = assetUid;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await api.get('/lifecycle/export', {
      params,
      responseType: 'blob',
    });
    
    const blob = new Blob([response as unknown as BlobPart], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `lifecycle_logs_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

export default lifecycleService;
