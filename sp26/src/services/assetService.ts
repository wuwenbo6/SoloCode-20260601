import { api } from '@/lib/axios';
import { storage } from '@/utils/storage';
import type {
  Asset,
  CreateAssetRequest,
  UpdateAssetRequest,
  PaginationParams,
  PaginatedResponse,
  ApiResponse,
  BatchStatusUpdateRequest,
} from '../../shared/types';

const handleCacheUpdate = async (data: Asset | Asset[]) => {
  try {
    if (Array.isArray(data)) {
      await storage.assets.putMany(data);
    } else {
      await storage.assets.put(data);
    }
  } catch {
    // Ignore cache errors
  }
};

export const assetService = {
  async getAssets(params?: PaginationParams): Promise<PaginatedResponse<Asset>> {
    const response = await api.get<ApiResponse<PaginatedResponse<Asset>>>('/assets', { params });
    const data = (response.data as ApiResponse<PaginatedResponse<Asset>>).data;
    if (!data) throw new Error('获取资产列表失败');
    
    if (data.items) {
      await handleCacheUpdate(data.items);
    }
    return data;
  },

  async getAssetByUid(uid: string): Promise<Asset> {
    try {
      const response = await api.get<ApiResponse<Asset>>(`/assets/${uid}`);
      const data = (response.data as ApiResponse<Asset>).data;
      if (!data) throw new Error('获取资产信息失败');
      await handleCacheUpdate(data);
      return data;
    } catch (error) {
      const cached = await storage.assets.getByUid(uid);
      if (cached) return cached;
      throw error;
    }
  },

  async createAsset(request: CreateAssetRequest): Promise<Asset> {
    const response = await api.post<ApiResponse<Asset>>('/assets', request);
    const data = (response.data as ApiResponse<Asset>).data;
    if (!data) throw new Error('创建资产失败');
    await handleCacheUpdate(data);
    return data;
  },

  async updateAsset(uid: string, request: UpdateAssetRequest): Promise<Asset> {
    const response = await api.put<ApiResponse<Asset>>(`/assets/${uid}`, request);
    const data = (response.data as ApiResponse<Asset>).data;
    if (!data) throw new Error('更新资产失败');
    await handleCacheUpdate(data);
    return data;
  },

  async deleteAsset(uid: string): Promise<void> {
    await api.delete<ApiResponse<void>>(`/assets/${uid}`);
    try {
      await storage.assets.delete(uid);
    } catch {
      // Ignore cache errors
    }
  },

  async batchUpdateStatus(request: BatchStatusUpdateRequest): Promise<void> {
    await api.post<ApiResponse<void>>('/assets/batch/status', request);
  },

  async getAssetsByCategory(category: string, params?: PaginationParams): Promise<PaginatedResponse<Asset>> {
    const response = await api.get<ApiResponse<PaginatedResponse<Asset>>>(`/assets/category/${category}`, { params });
    const data = (response.data as ApiResponse<PaginatedResponse<Asset>>).data;
    if (!data) throw new Error('获取分类资产失败');
    return data;
  },

  async getAssetsByStatus(status: string, params?: PaginationParams): Promise<PaginatedResponse<Asset>> {
    const response = await api.get<ApiResponse<PaginatedResponse<Asset>>>(`/assets/status/${status}`, { params });
    const data = (response.data as ApiResponse<PaginatedResponse<Asset>>).data;
    if (!data) throw new Error('获取状态资产失败');
    return data;
  },

  async searchAssets(query: string, params?: PaginationParams): Promise<PaginatedResponse<Asset>> {
    const response = await api.get<ApiResponse<PaginatedResponse<Asset>>>('/assets/search', {
      params: { q: query, ...params },
    });
    const data = (response.data as ApiResponse<PaginatedResponse<Asset>>).data;
    if (!data) throw new Error('搜索资产失败');
    return data;
  },

  async getStats() {
    type StatsResponse = {
      total: number;
      byStatus: Record<string, number>;
      byCategory: Record<string, number>;
    };
    const response = await api.get<ApiResponse<StatsResponse>>('/assets/stats');
    const data = (response.data as ApiResponse<StatsResponse>).data;
    if (!data) throw new Error('获取统计信息失败');
    return data;
  },

  async getCategories(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/assets/categories');
    const data = (response.data as ApiResponse<string[]>).data;
    if (!data) throw new Error('获取分类列表失败');
    return data;
  },
};
