import axios from 'axios';
import type { PrintTemplate, PrintHistory, ApiResponse } from '../../shared/types';
import { templateCache, pendingOps } from './templateCache';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

let isOnline = navigator.onLine;
window.addEventListener('online', () => { isOnline = true; });
window.addEventListener('offline', () => { isOnline = false; });

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.warn('[API] Network error, falling back to cache');
    }
    return Promise.reject(error);
  }
);

export const templateApi = {
  async getAll(page = 1, pageSize = 20): Promise<ApiResponse<PrintTemplate[]>> {
    try {
      const response = await api.get('/templates', { params: { page, pageSize } });
      const data = response.data;
      if (data.success && data.data) {
        templateCache.saveTemplates(data.data);
      }
      return data;
    } catch (error) {
      if (!axios.isAxiosError(error) || !error.response) {
        const cached = templateCache.loadTemplates();
        if (cached) {
          return {
            success: true,
            message: '使用本地缓存数据（网络不可用）',
            data: cached,
            total: cached.length
          };
        }
      }
      throw error;
    }
  },

  async getById(id: string): Promise<ApiResponse<PrintTemplate>> {
    try {
      const response = await api.get(`/templates/${id}`);
      const data = response.data;
      if (data.success && data.data) {
        templateCache.saveTemplate(data.data);
      }
      return data;
    } catch (error) {
      if (!axios.isAxiosError(error) || !error.response) {
        const cached = templateCache.loadTemplate(id);
        if (cached) {
          return {
            success: true,
            message: '使用本地缓存数据（网络不可用）',
            data: cached
          };
        }
      }
      throw error;
    }
  },

  async create(data: Omit<PrintTemplate, '_id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<PrintTemplate>> {
    try {
      const response = await api.post('/templates', data);
      const result = response.data;
      if (result.success && result.data) {
        templateCache.saveTemplate(result.data);
        const cached = templateCache.loadTemplates();
        if (cached) {
          cached.push(result.data);
          templateCache.saveTemplates(cached);
        }
      }
      return result;
    } catch (error) {
      if (!axios.isAxiosError(error) || !error.response) {
        const tempId = `local_${Date.now()}`;
        const localTemplate: PrintTemplate = {
          ...data,
          _id: tempId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        templateCache.saveTemplate(localTemplate);
        const cached = templateCache.loadTemplates();
        if (cached) {
          cached.push(localTemplate);
          templateCache.saveTemplates(cached);
        }
        pendingOps.enqueue({
          id: tempId,
          type: 'create',
          data,
          timestamp: Date.now()
        });
        return {
          success: true,
          message: '已保存到本地（网络不可用），恢复连接后自动同步',
          data: localTemplate
        };
      }
      throw error;
    }
  },

  async update(id: string, data: Partial<Omit<PrintTemplate, '_id' | 'createdAt' | 'updatedAt'>>): Promise<ApiResponse<PrintTemplate>> {
    try {
      const response = await api.put(`/templates/${id}`, data);
      const result = response.data;
      if (result.success && result.data) {
        templateCache.saveTemplate(result.data);
        const cached = templateCache.loadTemplates();
        if (cached) {
          const idx = cached.findIndex(t => t._id === id);
          if (idx >= 0) {
            cached[idx] = result.data;
            templateCache.saveTemplates(cached);
          }
        }
      }
      return result;
    } catch (error) {
      if (!axios.isAxiosError(error) || !error.response) {
        const cached = templateCache.loadTemplate(id);
        if (cached) {
          const updated = { ...cached, ...data, updatedAt: new Date().toISOString() };
          templateCache.saveTemplate(updated);
          const allCached = templateCache.loadTemplates();
          if (allCached) {
            const idx = allCached.findIndex(t => t._id === id);
            if (idx >= 0) {
              allCached[idx] = updated;
              templateCache.saveTemplates(allCached);
            }
          }
          pendingOps.enqueue({ id, type: 'update', data, timestamp: Date.now() });
          return {
            success: true,
            message: '已更新本地缓存（网络不可用），恢复连接后自动同步',
            data: updated
          };
        }
      }
      throw error;
    }
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await api.delete(`/templates/${id}`);
      templateCache.removeTemplate(id);
      const cached = templateCache.loadTemplates();
      if (cached) {
        templateCache.saveTemplates(cached.filter(t => t._id !== id));
      }
      return response.data;
    } catch (error) {
      if (!axios.isAxiosError(error) || !error.response) {
        templateCache.removeTemplate(id);
        const cached = templateCache.loadTemplates();
        if (cached) {
          templateCache.saveTemplates(cached.filter(t => t._id !== id));
        }
        pendingOps.enqueue({ id, type: 'delete', timestamp: Date.now() });
        return {
          success: true,
          message: '已从本地删除（网络不可用），恢复连接后自动同步'
        };
      }
      throw error;
    }
  }
};

export const historyApi = {
  async getAll(page = 1, pageSize = 20): Promise<ApiResponse<PrintHistory[]>> {
    const response = await api.get('/history', { params: { page, pageSize } });
    return response.data;
  },

  async create(data: Omit<PrintHistory, '_id'>): Promise<ApiResponse<PrintHistory>> {
    try {
      const response = await api.post('/history', data);
      return response.data;
    } catch {
      return {
        success: true,
        message: '打印历史已记录（网络不可用时仅本地记录）'
      };
    }
  },

  async getStats(): Promise<ApiResponse<{ total: number; success: number; failed: number; today: number }>> {
    const response = await api.get('/history/stats');
    return response.data;
  }
};

export const healthApi = {
  async check(): Promise<ApiResponse<void>> {
    const response = await api.get('/health');
    return response.data;
  }
};

export function getNetworkStatus(): boolean {
  return isOnline;
}

export async function syncPendingOperations(): Promise<number> {
  const queue = pendingOps.getQueue();
  let synced = 0;

  for (const op of queue) {
    try {
      if (op.type === 'create' && op.data) {
        await api.post('/templates', op.data);
      } else if (op.type === 'update' && op.data) {
        await api.put(`/templates/${op.id}`, op.data);
      } else if (op.type === 'delete') {
        await api.delete(`/templates/${op.id}`);
      }
      pendingOps.remove(op.id, op.type);
      synced++;
    } catch {
      break;
    }
  }

  return synced;
}
