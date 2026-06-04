import InventoryService from './InventoryService.js';
import LocationService from './LocationService.js';
import AssetService from './AssetService.js';
import type { 
  SyncQueueItem, 
  SyncQueueType,
  BatchInventoryRequest,
  UpdateAssetRequest,
  LocationTrack,
  ApiResponse
} from '../../shared/types.js';
import logger from '../lib/logger.js';

interface SyncResult {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export class OfflineSyncService {
  static async sync(items: SyncQueueItem[], userId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const item of items) {
      try {
        await this.processSyncItem(item, userId);
        result.success++;
        logger.info(`Sync item succeeded: ${item.id} (${item.type})`);
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: item.id,
          error: error instanceof Error ? error.message : '未知错误'
        });
        logger.error(`Sync item failed: ${item.id} (${item.type})`, error);
      }
    }

    logger.info(`Sync completed: ${result.success} success, ${result.failed} failed`);

    return result;
  }

  private static async processSyncItem(item: SyncQueueItem, userId: string): Promise<void> {
    switch (item.type) {
      case 'inventory':
        await this.processInventory(item.data, userId);
        break;
      case 'batch_inventory':
        await this.processBatchInventory(item.data, userId);
        break;
      case 'location':
        await this.processLocation(item.data, userId);
        break;
      case 'asset_update':
        await this.processAssetUpdate(item.data);
        break;
      default:
        throw new Error(`未知的同步类型: ${(item as SyncQueueItem).type}`);
    }
  }

  private static async processInventory(data: unknown, userId: string): Promise<void> {
    const inventoryData = data as {
      assetUid: string;
      status: string;
      location?: unknown;
      scannedAt: string;
      note?: string;
    };

    await InventoryService.createRecord({
      assetUid: inventoryData.assetUid,
      status: inventoryData.status as never,
      location: inventoryData.location as never,
      scannedBy: userId,
      scannedAt: inventoryData.scannedAt,
      note: inventoryData.note || '',
      isOffline: true
    });
  }

  private static async processBatchInventory(data: unknown, userId: string): Promise<void> {
    const batchData = data as BatchInventoryRequest;
    await InventoryService.batchCreateRecords(batchData, userId, true);
  }

  private static async processLocation(data: unknown, userId: string): Promise<void> {
    const locationData = data as Omit<LocationTrack, '_id' | 'trackedBy' | 'asset'>;

    await LocationService.trackLocation({
      ...locationData,
      trackedBy: userId
    });
  }

  private static async processAssetUpdate(data: unknown): Promise<void> {
    const updateData = data as {
      uid: string;
      updates: UpdateAssetRequest;
    };

    await AssetService.updateAsset(updateData.uid, updateData.updates);
  }

  static validateSyncData(items: SyncQueueItem[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    items.forEach((item, index) => {
      if (!item.id) {
        errors.push(`第${index + 1}条: 缺少id`);
      }
      if (!item.type) {
        errors.push(`第${index + 1}条: 缺少type`);
      }
      if (!item.data) {
        errors.push(`第${index + 1}条: 缺少data`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default OfflineSyncService;
