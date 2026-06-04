import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import type { ApiResponse } from '../../shared/types';
import { useAuthStore } from '@/store/authStore';
import { useOfflineStore } from '@/store/offlineStore';
import { storage } from '@/utils/storage';
import { generateIdempotencyKey } from '@/utils/nfc';

const TOKEN_KEY = 'auth_token';
const IDEMPOTENCY_HEADER = 'X-Idempotency-Key';

const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

const isNetworkError = (error: AxiosError): boolean => {
  return (
    !error.response ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    error.message.includes('Network Error') ||
    error.message.includes('timeout')
  );
};

const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: '/api',
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      const method = config.method?.toUpperCase();
      if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        if (!config.headers?.[IDEMPOTENCY_HEADER]) {
          const idempotencyKey = generateIdempotencyKey();
          if (config.headers) {
            config.headers[IDEMPOTENCY_HEADER] = idempotencyKey;
          }
        }
      }
      
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const apiResponse = response.data as ApiResponse;
      if (apiResponse && !apiResponse.success && apiResponse.error) {
        return Promise.reject(new Error(apiResponse.error.message));
      }
      return response.data;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config;
      
      if (error.response?.status === 401) {
        removeToken();
        const authStore = useAuthStore.getState();
        authStore.clearAuth();
        return Promise.reject(new Error('认证已过期，请重新登录'));
      }

      if (error.response?.status === 409 && error.response?.data) {
        const apiResponse = error.response.data as ApiResponse;
        if (apiResponse.isDuplicate) {
          return Promise.resolve({
            ...apiResponse,
            success: true,
          });
        }
      }

      if (isNetworkError(error) && originalRequest) {
        const method = originalRequest.method?.toUpperCase();
        const url = originalRequest.url || '';
        
        if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const offlineStore = useOfflineStore.getState();
          const type = determineSyncType(url, method);
          
          if (type) {
            const data = originalRequest.data ? JSON.parse(originalRequest.data) : {};
            const idempotencyKey = 
              (originalRequest.headers as Record<string, string>)?.[IDEMPOTENCY_HEADER] || 
              generateIdempotencyKey();
            
            const queueId = await storage.syncQueue.add({
              type: type as any,
              data: {
                url,
                method,
                data,
                headers: {
                  ...originalRequest.headers,
                  [IDEMPOTENCY_HEADER]: idempotencyKey,
                },
              },
              idempotencyKey,
            });

            offlineStore.addToQueue(type as any, {
              url,
              method,
              data,
              headers: {
                ...originalRequest.headers,
                [IDEMPOTENCY_HEADER]: idempotencyKey,
              },
              idempotencyKey,
            });

            offlineStore.setOnline(false);

            return Promise.resolve({
              success: true,
              data: {
                offline: true,
                queueId,
                idempotencyKey,
                message: '网络异常，已加入离线同步队列',
              },
              idempotencyKey,
            } as ApiResponse);
          }
        }

        if (method === 'GET') {
          const cachedData = await getCachedData(url);
          if (cachedData) {
            return Promise.resolve({
              success: true,
              data: cachedData,
              fromCache: true,
            } as ApiResponse);
          }
        }
      }

      const errorMessage = (error.response?.data as any)?.error?.message || error.message || '请求失败';
      return Promise.reject(new Error(errorMessage));
    }
  );

  return instance;
};

const determineSyncType = (url: string, method: string): string | null => {
  if (url.includes('/auth/')) return null;
  
  if (url.includes('/assets/') || url.includes('/assets')) {
    if (method === 'PUT' || method === 'PATCH') return 'asset_update';
  }
  
  if (url.includes('/inventory/') || url.includes('/inventory')) {
    if (url.includes('/batch')) return 'batch_inventory';
    return 'inventory';
  }
  
  if (url.includes('/location/') || url.includes('/location')) {
    return 'location';
  }
  
  if (url.includes('/batch')) return 'batch_inventory';
  
  return null;
};

const getCachedData = async (url: string): Promise<unknown | null> => {
  try {
    if (url.includes('/assets') && !url.includes('/assets/')) {
      return await storage.assets.getAll();
    }
    if (url.match(/\/assets\/[^/]+$/)) {
      const uid = url.split('/').pop();
      if (uid) return await storage.assets.getByUid(uid);
    }
    if (url.includes('/inventory/records')) {
      return await storage.inventoryRecords.getAll();
    }
    if (url.includes('/location/tracks')) {
      return await storage.locationTracks.getAll();
    }
  } catch {
    return null;
  }
  return null;
};

const api = createAxiosInstance();

export { api, getToken, setToken, removeToken, isNetworkError, IDEMPOTENCY_HEADER };

export default api;
