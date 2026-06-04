import axios from 'axios';
import { storage } from '@/utils/storage';
import { useOfflineStore } from '@/store/offlineStore';
import { getToken } from '@/lib/axios';
import type { SyncQueueItem, SyncQueueType, ApiResponse } from '../../shared/types';

interface QueueData {
  url: string;
  method: string;
  data: unknown;
  headers?: Record<string, string>;
}

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;

const executeRequest = async (item: SyncQueueItem): Promise<unknown> => {
  const queueData = item.data as QueueData;
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...queueData.headers,
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const response = await axios({
    url: queueData.url,
    method: queueData.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: queueData.data,
    headers,
    baseURL: '/api',
    timeout: 15000,
  });
  
  const apiResponse = response.data as ApiResponse;
  if (!apiResponse.success && apiResponse.error) {
    throw new Error(apiResponse.error.message);
  }
  
  return apiResponse.data;
};

const processQueueItem = async (item: SyncQueueItem): Promise<void> => {
  const offlineStore = useOfflineStore.getState();
  
  try {
    offlineStore.updateQueueItem(item.id, { retryCount: item.retryCount + 1 });
    await executeRequest(item);
    await storage.syncQueue.delete(item.id);
    offlineStore.removeFromQueue(item.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '同步失败';
    const newRetryCount = item.retryCount + 1;
    
    if (newRetryCount >= MAX_RETRIES) {
      offlineStore.updateQueueItem(item.id, {
        error: errorMessage,
        retryCount: newRetryCount,
      });
      await storage.syncQueue.put({
        ...item,
        error: errorMessage,
        retryCount: newRetryCount,
      });
    } else {
      offlineStore.updateQueueItem(item.id, {
        error: errorMessage,
        retryCount: newRetryCount,
      });
      await storage.syncQueue.put({
        ...item,
        error: errorMessage,
        retryCount: newRetryCount,
      });
      throw error;
    }
  }
};

export const offlineSyncService = {
  async loadQueueFromStorage(): Promise<void> {
    const offlineStore = useOfflineStore.getState();
    try {
      const queue = await storage.syncQueue.getAll();
      queue.forEach((item) => {
        const exists = offlineStore.queue.some((q) => q.id === item.id);
        if (!exists) {
          offlineStore.queue.push(item);
        }
      });
    } catch {
      // Ignore storage errors
    }
  },

  async addToQueue(type: SyncQueueType, data: unknown): Promise<string> {
    const offlineStore = useOfflineStore.getState();
    const id = await storage.syncQueue.add({ type, data });
    offlineStore.addToQueue(type, data);
    return id;
  },

  async sync(): Promise<{
    total: number;
    success: number;
    failed: number;
  }> {
    const offlineStore = useOfflineStore.getState();
    
    if (offlineStore.isSyncing) {
      return { total: 0, success: 0, failed: 0 };
    }
    
    if (!navigator.onLine) {
      offlineStore.setOnline(false);
      throw new Error('网络不可用');
    }
    
    offlineStore.setSyncing(true);
    offlineStore.setOnline(true);
    
    const queue = await storage.syncQueue.getAll();
    const total = queue.length;
    let success = 0;
    let failed = 0;
    
    for (const item of queue) {
      if (item.retryCount >= MAX_RETRIES) {
        failed++;
        continue;
      }
      
      try {
        await processQueueItem(item);
        success++;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      } catch {
        failed++;
      }
    }
    
    offlineStore.setSyncing(false);
    offlineStore.setLastSyncAt(new Date().toISOString());
    
    return { total, success, failed };
  },

  async syncItem(id: string): Promise<void> {
    const offlineStore = useOfflineStore.getState();
    const queue = await storage.syncQueue.getAll();
    const item = queue.find((q) => q.id === id);
    
    if (!item) {
      throw new Error('队列项不存在');
    }
    
    await processQueueItem(item);
  },

  async clearQueue(): Promise<void> {
    const offlineStore = useOfflineStore.getState();
    await storage.syncQueue.clear();
    offlineStore.clearQueue();
  },

  async removeFromQueue(id: string): Promise<void> {
    const offlineStore = useOfflineStore.getState();
    await storage.syncQueue.delete(id);
    offlineStore.removeFromQueue(id);
  },

  async getFailedItems(): Promise<SyncQueueItem[]> {
    const queue = await storage.syncQueue.getAll();
    return queue.filter((item) => item.retryCount >= MAX_RETRIES);
  },

  async retryFailedItems(): Promise<{
    total: number;
    success: number;
    failed: number;
  }> {
    const failedItems = await this.getFailedItems();
    const offlineStore = useOfflineStore.getState();
    
    for (const item of failedItems) {
      offlineStore.updateQueueItem(item.id, {
        retryCount: 0,
        error: undefined,
      });
      await storage.syncQueue.put({
        ...item,
        retryCount: 0,
        error: undefined,
      });
    }
    
    return this.sync();
  },

  getQueueStats(): {
    total: number;
    pending: number;
    failed: number;
  } {
    const offlineStore = useOfflineStore.getState();
    const queue = offlineStore.queue;
    return {
      total: queue.length,
      pending: queue.filter((item) => item.retryCount < MAX_RETRIES).length,
      failed: queue.filter((item) => item.retryCount >= MAX_RETRIES).length,
    };
  },

  async startAutoSync(intervalMs = 30000): Promise<() => void> {
    const syncIfOnline = async () => {
      if (navigator.onLine) {
        try {
          await this.sync();
        } catch {
          // Ignore sync errors
        }
      }
    };
    
    const handleOnline = () => {
      useOfflineStore.getState().setOnline(true);
      syncIfOnline();
    };
    
    const handleOffline = () => {
      useOfflineStore.getState().setOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const intervalId = setInterval(syncIfOnline, intervalMs);
    
    syncIfOnline();
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
};
