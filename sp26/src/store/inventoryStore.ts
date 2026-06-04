import { create } from 'zustand';
import type { LocationData } from '../../shared/types';
import type { InventoryState, InventoryActions } from '@/types';

interface InventoryStore extends InventoryState, InventoryActions {}

const initialState: InventoryState = {
  sessionId: null,
  isSessionActive: false,
  location: null,
  startTime: null,
  scannedCount: 0,
  totalExpected: 0,
};

export const useInventoryStore = create<InventoryStore>((set) => ({
  ...initialState,

  startSession: (totalExpected?: number) => {
    const sessionId = crypto.randomUUID();
    set({
      sessionId,
      isSessionActive: true,
      startTime: new Date().toISOString(),
      scannedCount: 0,
      totalExpected: totalExpected || 0,
    });
    return sessionId;
  },

  endSession: () => {
    set({
      isSessionActive: false,
      sessionId: null,
      startTime: null,
    });
  },

  setLocation: (location: LocationData) => set({ location }),

  incrementScanned: () => {
    set((state) => ({
      scannedCount: state.scannedCount + 1,
    }));
  },

  reset: () => set(initialState),
}));
