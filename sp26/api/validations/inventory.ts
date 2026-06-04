import { z } from 'zod';
import type { AssetStatus, SyncQueueType } from '../../shared/types.js';

const assetStatusEnum: [AssetStatus, ...AssetStatus[]] = ['in_use', 'idle', 'maintenance', 'scrapped'];
const syncQueueTypeEnum: [SyncQueueType, ...SyncQueueType[]] = ['asset_update', 'inventory', 'location', 'batch_inventory'];

const beaconSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  rssi: z.number(),
  uuid: z.string().optional(),
  major: z.number().optional(),
  minor: z.number().optional()
});

const locationDataSchema = z.object({
  gps: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional()
  }),
  beacons: z.array(beaconSchema).default([])
});

export const inventoryItemSchema = z.object({
  uid: z.string().min(1, '资产UID不能为空'),
  status: z.enum(assetStatusEnum),
  note: z.string().optional(),
  scannedAt: z.string()
});

export const batchInventorySchema = z.object({
  items: z.array(inventoryItemSchema).min(1, '至少提交一条盘点记录'),
  location: locationDataSchema.optional()
});

export const inventoryRecordSchema = z.object({
  assetUid: z.string().min(1, '资产UID不能为空'),
  status: z.enum(assetStatusEnum),
  location: locationDataSchema.optional(),
  scannedBy: z.string().min(1, '盘点人不能为空'),
  scannedAt: z.string(),
  note: z.string().optional(),
  isOffline: z.boolean().default(false)
});

export const getInventoryRecordsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  assetUid: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export const syncQueueItemSchema = z.object({
  id: z.string(),
  type: z.enum(syncQueueTypeEnum),
  data: z.unknown(),
  createdAt: z.string(),
  retryCount: z.number().default(0),
  error: z.string().optional()
});

export const offlineSyncSchema = z.object({
  items: z.array(syncQueueItemSchema).min(1, '至少提交一条同步数据')
});

export type BatchInventoryInput = z.infer<typeof batchInventorySchema>;
export type InventoryRecordInput = z.infer<typeof inventoryRecordSchema>;
export type GetInventoryRecordsQueryInput = z.infer<typeof getInventoryRecordsQuerySchema>;
export type OfflineSyncInput = z.infer<typeof offlineSyncSchema>;
