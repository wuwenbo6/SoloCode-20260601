import { create } from 'zustand';
import type { Asset, AssetStatus, InventoryItem } from '../../shared/types';
import type { ScanState, ScanActions } from '@/types';

interface ScanStore extends ScanState, ScanActions {}

const initialState: ScanState = {
  isScanning: false,
  isInventoryMode: false,
  inventoryStatus: 'in_use',
  scannedItems: [],
  currentAsset: null,
  error: null,
};

const DEBOUNCE_WINDOW_MS = 3000;

export const useScanStore = create<ScanStore>((set, get) => ({
  ...initialState,

  startScanning: () => set({ isScanning: true, error: null }),

  stopScanning: () => set({ isScanning: false }),

  toggleInventoryMode: (enabled: boolean) => set({ isInventoryMode: enabled }),

  setInventoryStatus: (status: AssetStatus) => set({ inventoryStatus: status }),

  addScannedItem: (item: { uid: string; status: AssetStatus; note?: string }) => {
    const { scannedItems } = get();
    
    const uid = item.uid.trim().toUpperCase();
    const now = Date.now();
    
    const exists = scannedItems.some((i) => {
      if (i.uid.trim().toUpperCase() !== uid) return false;
      
      const scannedTime = new Date(i.scannedAt).getTime();
      const timeDiff = now - scannedTime;
      
      return timeDiff < DEBOUNCE_WINDOW_MS * 10;
    });
    
    if (exists) {
      return false;
    }
    
    const newItem: InventoryItem = {
      ...item,
      uid,
      scannedAt: new Date().toISOString(),
    };
    
    set({ scannedItems: [...scannedItems, newItem] });
    return true;
  },

  checkAndAddScannedItem: (uid: string, idempotencyKey?: string): {
    added: boolean;
    isDuplicate: boolean;
    reason?: string;
  } => {
    const { scannedItems } = get();
    const normalizedUid = uid.trim().toUpperCase();
    const now = Date.now();

    const existingItem = scannedItems.find((i) => i.uid.trim().toUpperCase() === normalizedUid);
    
    if (existingItem) {
      const scannedTime = new Date(existingItem.scannedAt).getTime();
      const timeDiff = now - scannedTime;
      
      return {
        added: false,
        isDuplicate: true,
        reason: `该标签已于 ${Math.round(timeDiff / 1000)} 秒前已扫描`,
      };
    }
    
    return {
      added: true,
      isDuplicate: false,
    };
  },

  removeScannedItem: (uid: string) => {
    const { scannedItems } = get();
    set({
      scannedItems: scannedItems.filter((item) => item.uid !== uid),
    });
  },

  clearScannedItems: () => set({ scannedItems: [] }),

  setCurrentAsset: (asset: Asset | null) => set({ currentAsset: asset }),

  setError: (error: string | null) => set({ error }),

  reset: () => set(initialState),
}));
