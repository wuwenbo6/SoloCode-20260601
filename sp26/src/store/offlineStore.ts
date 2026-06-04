import { create } from 'zustand';
import type { SyncQueueType, SyncQueueItem } from '../../shared/types';
import type { OfflineState, OfflineActions } from '@/types';

interface OfflineStore extends OfflineState, OfflineActions {}

const initialState: OfflineState = {
  queue: [],
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  lastSyncAt: null,
};

export const useOfflineStore = create<OfflineStore>((set, get) => ({
  ...initialState,

  addToQueue: (type: SyncQueueType, data: unknown) => {
    const { queue } = get();
    const newItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      type,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    set({ queue: [...queue, newItem] });
  },

  removeFromQueue: (id: string) => {
    const { queue } = get();
    set({
      queue: queue.filter((item) => item.id !== id),
    });
  },

  updateQueueItem: (id: string, updates: Partial<SyncQueueItem>) => {
    const { queue } = get();
    set({
      queue: queue.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    });
  },

  clearQueue: () => set({ queue: [] }),

  setOnline: (online: boolean) => set({ isOnline: online }),

  setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),

  setLastSyncAt: (time: string) => set({ lastSyncAt: time }),
}));
