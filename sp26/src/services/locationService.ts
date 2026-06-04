import { api } from '@/lib/axios';
import { storage } from '@/utils/storage';
import type {
  LocationTrack,
  LocationData,
  PaginationParams,
  PaginatedResponse,
  ApiResponse,
} from '../../shared/types';

type NearbyAssetItem = {
  asset: {
    _id: string;
    uid: string;
    name: string;
    category: string;
    location: string;
    status: string;
  };
  track: LocationTrack;
  distance: number;
};

type LocationStats = {
  totalTracks: number;
  todayTracks: number;
  activeAssets: number;
  byLocation: Record<string, number>;
};

export const locationService = {
  async createLocationTrack(
    assetUid: string,
    location: LocationData
  ): Promise<LocationTrack> {
    const response = await api.post<ApiResponse<LocationTrack>>('/location/track', {
      assetUid,
      gps: location.gps,
      beacons: location.beacons,
    });
    const data = (response.data as ApiResponse<LocationTrack>).data;
    if (!data) throw new Error('创建位置追踪失败');
    
    try {
      await storage.locationTracks.put(data);
    } catch {
      // Ignore cache errors
    }
    
    return data;
  },

  async getLocationTracks(params?: PaginationParams): Promise<PaginatedResponse<LocationTrack>> {
    const response = await api.get<ApiResponse<PaginatedResponse<LocationTrack>>>('/location/tracks', { params });
    const data = (response.data as ApiResponse<PaginatedResponse<LocationTrack>>).data;
    if (!data) throw new Error('获取位置追踪列表失败');
    
    if (data.items) {
      try {
        await storage.locationTracks.putMany(data.items);
      } catch {
        // Ignore cache errors
      }
    }
    
    return data;
  },

  async getLocationTracksByAsset(
    assetUid: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<LocationTrack>> {
    const response = await api.get<ApiResponse<PaginatedResponse<LocationTrack>>>(`/location/asset/${assetUid}`, { params });
    const data = (response.data as ApiResponse<PaginatedResponse<LocationTrack>>).data;
    if (!data) throw new Error('获取资产位置历史失败');
    return data;
  },

  async getLatestLocation(assetUid: string): Promise<LocationTrack | null> {
    try {
      const response = await api.get<ApiResponse<LocationTrack>>(`/location/asset/${assetUid}/latest`);
      const data = (response.data as ApiResponse<LocationTrack>).data;
      return data || null;
    } catch (error) {
      try {
        const cached = await storage.locationTracks.getByAssetUid(assetUid);
        if (cached.length > 0) {
          return cached[cached.length - 1];
        }
      } catch {
        // Ignore cache errors
      }
      throw error;
    }
  },

  async getNearbyAssets(
    lat: number,
    lng: number,
    radius = 100,
    params?: PaginationParams
  ): Promise<PaginatedResponse<NearbyAssetItem>> {
    const response = await api.get<ApiResponse<PaginatedResponse<NearbyAssetItem>>>('/location/nearby', {
      params: { lat, lng, radius, ...params },
    });
    const data = (response.data as ApiResponse<PaginatedResponse<NearbyAssetItem>>).data;
    if (!data) throw new Error('获取附近资产失败');
    return data;
  },

  async getLocationStats(): Promise<LocationStats> {
    const response = await api.get<ApiResponse<LocationStats>>('/location/stats');
    const data = (response.data as ApiResponse<LocationStats>).data;
    if (!data) throw new Error('获取位置统计失败');
    return data;
  },

  async getRecentHistory(limit = 20): Promise<LocationTrack[]> {
    const result = await this.getLocationTracks({ limit, page: 1 });
    return result.items;
  },

  async getHistoryByAsset(assetUid: string, limit = 20): Promise<LocationTrack[]> {
    const result = await this.getLocationTracksByAsset(assetUid, { limit, page: 1 });
    return result.items;
  },

  async deleteLocationTrack(id: string): Promise<void> {
    await api.delete<ApiResponse<void>>(`/location/tracks/${id}`);
    try {
      await storage.locationTracks.delete(id);
    } catch {
      // Ignore cache errors
    }
  },
};
