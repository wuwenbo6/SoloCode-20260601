import type { User, SyncQueueType, LocationData, AssetStatus } from '../../shared/types';

declare global {
  interface Window {
    __APP_VERSION__?: string;
  }
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
  clearAuth: () => void;
  setAuth: (user: User, token: string) => void;
}

export interface ScanState {
  isScanning: boolean;
  isInventoryMode: boolean;
  inventoryStatus: AssetStatus;
  scannedItems: {
    uid: string;
    status: AssetStatus;
    note?: string;
    scannedAt: string;
  }[];
  currentAsset: {
    _id: string;
    uid: string;
    name: string;
    category: string;
    location: string;
    status: AssetStatus;
    description?: string;
    imageUrl?: string;
    purchaseDate?: string;
    purchasePrice?: number;
    lastInventoryAt?: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  error: string | null;
}

export interface ScanActions {
  startScanning: () => void;
  stopScanning: () => void;
  toggleInventoryMode: (enabled: boolean) => void;
  setInventoryStatus: (status: AssetStatus) => void;
  addScannedItem: (item: { uid: string; status: AssetStatus; note?: string }) => boolean;
  checkAndAddScannedItem: (uid: string, idempotencyKey?: string) => {
    added: boolean;
    isDuplicate: boolean;
    reason?: string;
  };
  removeScannedItem: (uid: string) => void;
  clearScannedItems: () => void;
  setCurrentAsset: (asset: ScanState['currentAsset']) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export interface InventoryState {
  sessionId: string | null;
  isSessionActive: boolean;
  location: LocationData | null;
  startTime: string | null;
  scannedCount: number;
  totalExpected: number;
}

export interface InventoryActions {
  startSession: (totalExpected?: number) => void;
  endSession: () => void;
  setLocation: (location: LocationData) => void;
  incrementScanned: () => void;
  reset: () => void;
}

export interface OfflineState {
  queue: {
    id: string;
    type: SyncQueueType;
    data: unknown;
    createdAt: string;
    retryCount: number;
    error?: string;
  }[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
}

export interface OfflineActions {
  addToQueue: (type: SyncQueueType, data: unknown) => void;
  removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<OfflineState['queue'][number]>) => void;
  clearQueue: () => void;
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncAt: (time: string) => void;
}

export interface NFCState {
  isSupported: boolean;
  isAvailable: boolean;
  isScanning: boolean;
  error: string | null;
  lastRead: {
    uid: string;
    serialNumber?: string;
    message?: NDEFRecordInit[];
  } | null;
}

export interface GeolocationState {
  isSupported: boolean;
  isWatching: boolean;
  position: {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: number;
  } | null;
  error: string | null;
}

export interface BluetoothState {
  isSupported: boolean;
  isScanning: boolean;
  devices: {
    id: string;
    name?: string;
    rssi: number;
    uuid?: string;
    major?: number;
    minor?: number;
  }[];
  error: string | null;
}

export {};
