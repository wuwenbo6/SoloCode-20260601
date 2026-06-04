export type AssetStatus = 'in_use' | 'idle' | 'maintenance' | 'scrapped';

export const AssetStatusLabels: Record<AssetStatus, string> = {
  in_use: '在用',
  idle: '闲置',
  maintenance: '维修中',
  scrapped: '报废'
};

export const AssetStatusColors: Record<AssetStatus, string> = {
  in_use: 'bg-green-100 text-green-800',
  idle: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  scrapped: 'bg-red-100 text-red-800'
};

export interface Asset {
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
}

export interface BeaconInfo {
  id: string;
  name?: string;
  rssi: number;
  uuid?: string;
  major?: number;
  minor?: number;
}

export interface BeaconPosition {
  id: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  name?: string;
}

export interface LocationData {
  gps: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  beacons: BeaconInfo[];
}

export interface InventoryRecord {
  _id: string;
  assetUid: string;
  status: AssetStatus;
  location?: LocationData;
  scannedBy: string;
  scannedAt: string;
  note?: string;
  isOffline: boolean;
  asset?: Asset;
}

export interface LocationTrack {
  _id: string;
  assetUid: string;
  gps: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  beacons: BeaconInfo[];
  trackedAt: string;
  trackedBy: string;
  asset?: Asset;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'inventory';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  idempotencyKey?: string;
  isDuplicate?: boolean;
}

export interface BatchStatusUpdateRequest {
  uids: string[];
  status: AssetStatus;
  note?: string;
}

export interface InventoryItem {
  uid: string;
  status: AssetStatus;
  note?: string;
  scannedAt: string;
}

export interface BatchInventoryRequest {
  items: InventoryItem[];
  location?: LocationData;
}

export type SyncQueueType = 'asset_update' | 'inventory' | 'location' | 'batch_inventory';

export interface SyncQueueItem {
  id: string;
  type: SyncQueueType;
  data: unknown;
  createdAt: string;
  retryCount: number;
  error?: string;
  idempotencyKey?: string;
  syncedAt?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: AssetStatus;
  category?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateAssetRequest {
  uid: string;
  name: string;
  category: string;
  location: string;
  status: AssetStatus;
  description?: string;
  imageUrl?: string;
  purchaseDate?: string;
  purchasePrice?: number;
}

export interface UpdateAssetRequest {
  name?: string;
  category?: string;
  location?: string;
  status?: AssetStatus;
  description?: string;
  imageUrl?: string;
  purchaseDate?: string;
  purchasePrice?: number;
}

export interface NFCReadResult {
  uid: string;
  serialNumber?: string;
  message?: NDEFRecordInit[];
  idempotencyKey?: string;
}

export type LifecycleAction = 
  | 'scan' 
  | 'inventory' 
  | 'status_change' 
  | 'location_update' 
  | 'write_tag' 
  | 'lock_tag'
  | 'create' 
  | 'update' 
  | 'delete'
  | 'import'
  | 'export';

export const LifecycleActionLabels: Record<LifecycleAction, string> = {
  scan: '扫码查看',
  inventory: '盘点',
  status_change: '状态变更',
  location_update: '位置更新',
  write_tag: '写入标签',
  lock_tag: '锁定标签',
  create: '创建资产',
  update: '更新资产',
  delete: '删除资产',
  import: '批量导入',
  export: '批量导出',
};

export interface AssetLifecycleLog {
  _id: string;
  assetUid: string;
  action: LifecycleAction;
  performedBy: string;
  performedAt: string;
  location?: LocationData;
  note?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  asset?: Asset;
  user?: User;
}

export interface LifecycleLogQueryParams extends PaginationParams {
  assetUid?: string;
  action?: LifecycleAction;
  performedBy?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportData {
  totalScans: number;
  totalInventory: number;
  statusChanges: number;
  locationUpdates: number;
  byUser: Array<{ userId: string; userName: string; count: number }>;
  byAction: Array<{ action: LifecycleAction; count: number }>;
  byStatus: Array<{ status: AssetStatus; count: number }>;
  byLocation: Array<{ location: string; count: number }>;
  dateRange: { start: string; end: string };
}

export interface NFCWriteOptions {
  uid?: string;
  records: NDEFRecordInit[];
  lockAfterWrite?: boolean;
}

export interface ScanSession {
  isScanning: boolean;
  isInventoryMode: boolean;
  inventoryStatus: AssetStatus;
  scannedItems: InventoryItem[];
  currentAsset: Asset | null;
  error: string | null;
}
