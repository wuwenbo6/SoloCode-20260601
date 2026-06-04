import { api } from '@/lib/axios';
import { storage } from '@/utils/storage';
import type {
  InventoryRecord,
  InventoryItem,
  BatchInventoryRequest,
  PaginationParams,
  PaginatedResponse,
  ApiResponse,
  LocationData,
} from '../../shared/types';

type BatchResult = {
  success: number;
  failed: number;
  records: InventoryRecord[];
};

type InventoryStats = {
  totalRecords: number;
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
  byStatus: Record<string, number>;
};

type UncountedAsset = {
  _id: string;
  uid: string;
  name: string;
  category: string;
  location: string;
  status: string;
  lastInventoryAt?: string;
};

export const inventoryService = {
  async createInventoryRecord(
    assetUid: string,
    status: string,
    location?: LocationData,
    note?: string
  ): Promise<InventoryRecord> {
    const request = {
      assetUid,
      status,
      location,
      note,
    };
    const response = await api.post<ApiResponse<InventoryRecord>>('/inventory/record', request);
    const data = (response.data as ApiResponse<InventoryRecord>).data;
    if (!data) throw new Error('创建盘点记录失败');
    
    try {
      await storage.inventoryRecords.put(data);
    } catch {
      // Ignore cache errors
    }
    
    return data;
  },

  async batchInventory(request: BatchInventoryRequest): Promise<BatchResult> {
    const response = await api.post<ApiResponse<BatchResult>>('/inventory/batch', request);
    const data = (response.data as ApiResponse<BatchResult>).data;
    if (!data) throw new Error('批量盘点失败');
    
    try {
      await storage.inventoryRecords.putMany(data.records);
    } catch {
      // Ignore cache errors
    }
    
    return data;
  },

  async submitScannedItems(
    items: InventoryItem[],
    location?: LocationData
  ): Promise<{
    success: number;
    failed: number;
    records: InventoryRecord[];
  }> {
    return this.batchInventory({ items, location });
  },

  async getInventoryRecords(params?: PaginationParams): Promise<PaginatedResponse<InventoryRecord>> {
    const response = await api.get<ApiResponse<PaginatedResponse<InventoryRecord>>>('/inventory/records', { params });
    const data = (response.data as ApiResponse<PaginatedResponse<InventoryRecord>>).data;
    if (!data) throw new Error('获取盘点记录失败');
    
    if (data.items) {
      try {
        await storage.inventoryRecords.putMany(data.items);
      } catch {
        // Ignore cache errors
      }
    }
    
    return data;
  },

  async getInventoryRecord(id: string): Promise<InventoryRecord> {
    const response = await api.get<ApiResponse<InventoryRecord>>(`/inventory/records/${id}`);
    const data = (response.data as ApiResponse<InventoryRecord>).data;
    if (!data) throw new Error('获取盘点记录失败');
    return data;
  },

  async getInventoryByAssetUid(assetUid: string, params?: PaginationParams): Promise<PaginatedResponse<InventoryRecord>> {
    const response = await api.get<ApiResponse<PaginatedResponse<InventoryRecord>>>(`/inventory/asset/${assetUid}`, { params });
    const data = (response.data as ApiResponse<PaginatedResponse<InventoryRecord>>).data;
    if (!data) throw new Error('获取资产盘点历史失败');
    return data;
  },

  async getInventoryStats(): Promise<InventoryStats> {
    const response = await api.get<ApiResponse<InventoryStats>>('/inventory/stats');
    const data = (response.data as ApiResponse<InventoryStats>).data;
    if (!data) throw new Error('获取盘点统计失败');
    return data;
  },

  async getUncountedAssets(params?: PaginationParams): Promise<PaginatedResponse<UncountedAsset>> {
    const response = await api.get<ApiResponse<PaginatedResponse<UncountedAsset>>>('/inventory/uncounted', { params });
    const data = (response.data as ApiResponse<PaginatedResponse<UncountedAsset>>).data;
    if (!data) throw new Error('获取未盘点资产失败');
    return data;
  },

  async getRecordsByAsset(assetUid: string, params?: PaginationParams): Promise<InventoryRecord[]> {
    const result = await this.getInventoryByAssetUid(assetUid, params);
    return result.items;
  },

  async exportInventory(format: 'csv' | 'excel' = 'csv', startDate?: string, endDate?: string): Promise<Blob> {
    const response = await api.get('/inventory/export', {
      params: { format, startDate, endDate },
      responseType: 'blob',
    });
    return response as unknown as Blob;
  },
};
