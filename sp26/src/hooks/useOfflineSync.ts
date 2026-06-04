import { useState, useCallback, useEffect } from 'react';
import { useOfflineStore } from '@/store/offlineStore';
import { offlineSyncService } from '@/services/offlineSyncService';
import type { SyncQueueItem, SyncQueueType } from '../../shared/types';

interface UseOfflineSyncOptions {
  autoLoad?: boolean;
  autoSync?: boolean;
  syncInterval?: number;
}

export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const {
    autoLoad = true,
    autoSync = true,
    syncInterval = 30000,
  } = options;

  const queue = useOfflineStore((state) => state.queue);
  const isOnline = useOfflineStore((state) => state.isOnline);
  const isSyncing = useOfflineStore((state) => state.isSyncing);
  const lastSyncAt = useOfflineStore((state) => state.lastSyncAt);
  
  const [isLoading, setIsLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    if (autoLoad) {
      loadQueue();
    }
  }, [autoLoad]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    if (autoSync) {
      offlineSyncService.startAutoSync(syncInterval).then((fn) => {
        cleanup = fn;
      });
    }
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [autoSync, syncInterval]);

  const loadQueue = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await offlineSyncService.loadQueueFromStorage();
    } catch (err) {
      console.error('加载同步队列失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addToQueue = useCallback(async (
    type: SyncQueueType,
    data: unknown
  ): Promise<string> => {
    return offlineSyncService.addToQueue(type, data);
  }, []);

  const sync = useCallback(async (): Promise<{
    total: number;
    success: number;
    failed: number;
  }> => {
    setIsLoading(true);
    try {
      const result = await offlineSyncService.sync();
      setSyncResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '同步失败';
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncItem = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      await offlineSyncService.syncItem(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '同步单项失败';
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retryFailed = useCallback(async (): Promise<{
    total: number;
    success: number;
    failed: number;
  }> => {
    setIsLoading(true);
    try {
      const result = await offlineSyncService.retryFailedItems();
      setSyncResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '重试失败项失败';
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeFromQueue = useCallback(async (id: string): Promise<void> => {
    await offlineSyncService.removeFromQueue(id);
  }, []);

  const clearQueue = useCallback(async (): Promise<void> => {
    await offlineSyncService.clearQueue();
    setSyncResult(null);
  }, []);

  const getFailedItems = useCallback(async (): Promise<SyncQueueItem[]> => {
    return offlineSyncService.getFailedItems();
  }, []);

  const getStats = useCallback((): {
    total: number;
    pending: number;
    failed: number;
  } => {
    return offlineSyncService.getQueueStats();
  }, []);

  const stats = getStats();

  return {
    queue,
    isOnline,
    isSyncing,
    isLoading,
    lastSyncAt,
    syncResult,
    stats,
    loadQueue,
    addToQueue,
    sync,
    syncItem,
    retryFailed,
    removeFromQueue,
    clearQueue,
    getFailedItems,
  };
}
