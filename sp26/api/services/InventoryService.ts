import InventoryRecordModel from '../models/InventoryRecord.js';
import AssetService from './AssetService.js';
import { AppError } from '../middleware/errorHandler.js';
import type { 
  InventoryRecord, 
  BatchInventoryRequest,
  PaginatedResponse,
  InventoryItem
} from '../../shared/types.js';
import logger from '../lib/logger.js';

export interface GetInventoryRecordsParams {
  page?: number;
  limit?: number;
  assetUid?: string;
  startDate?: string;
  endDate?: string;
}

export class InventoryService {
  static async createRecord(record: Omit<InventoryRecord, '_id' | 'asset'>): Promise<InventoryRecord> {
    const asset = await AssetService.getAssetByUid(record.assetUid);
    if (!asset) {
      throw new AppError('资产不存在', 404, 'ASSET_NOT_FOUND');
    }

    const inventoryRecord = new InventoryRecordModel(record);
    await inventoryRecord.save();

    await AssetService.updateLastInventory(record.assetUid, record.scannedAt);
    await AssetService.updateAsset(record.assetUid, { status: record.status });

    logger.info(`Inventory record created: ${record.assetUid} by ${record.scannedBy}`);

    const result = await InventoryRecordModel.findById(inventoryRecord._id)
      .populate('asset')
      .lean();

    return result as unknown as InventoryRecord;
  }

  static async batchCreateRecords(
    request: BatchInventoryRequest,
    scannedBy: string,
    isOffline: boolean = false
  ): Promise<{ created: number; failed: string[] }> {
    const { items, location } = request;
    const failed: string[] = [];
    let created = 0;

    for (const item of items) {
      try {
        const asset = await AssetService.getAssetByUid(item.uid);
        if (!asset) {
          failed.push(`${item.uid}: 资产不存在`);
          continue;
        }

        const record = new InventoryRecordModel({
          assetUid: item.uid,
          status: item.status,
          location,
          scannedBy,
          scannedAt: item.scannedAt,
          note: item.note || '',
          isOffline
        });

        await record.save();
        await AssetService.updateLastInventory(item.uid, item.scannedAt);
        await AssetService.updateAsset(item.uid, { status: item.status });

        created++;
      } catch (error) {
        failed.push(`${item.uid}: ${error instanceof Error ? error.message : '未知错误'}`);
        logger.error(`Failed to create inventory record for ${item.uid}:`, error);
      }
    }

    logger.info(`Batch inventory completed: ${created} created, ${failed.length} failed`);

    return { created, failed };
  }

  static async getRecords(params: GetInventoryRecordsParams): Promise<PaginatedResponse<InventoryRecord>> {
    const { page = 1, limit = 20, assetUid, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (assetUid) {
      filter.assetUid = assetUid;
    }

    if (startDate || endDate) {
      filter.scannedAt = {};
      if (startDate) {
        (filter.scannedAt as Record<string, unknown>).$gte = startDate;
      }
      if (endDate) {
        (filter.scannedAt as Record<string, unknown>).$lte = endDate;
      }
    }

    const [items, total] = await Promise.all([
      InventoryRecordModel.find(filter)
        .sort({ scannedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('asset')
        .lean(),
      InventoryRecordModel.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: items as unknown as InventoryRecord[],
      total,
      page,
      limit,
      totalPages
    };
  }

  static async getRecordById(id: string): Promise<InventoryRecord | null> {
    const record = await InventoryRecordModel.findById(id)
      .populate('asset')
      .lean();
    return record as unknown as InventoryRecord | null;
  }

  static async getInventoryStats(): Promise<{
    totalRecords: number;
    todayRecords: number;
    thisWeekRecords: number;
    offlineRecords: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [totalRecords, todayRecords, thisWeekRecords, offlineRecords] = await Promise.all([
      InventoryRecordModel.countDocuments(),
      InventoryRecordModel.countDocuments({ scannedAt: { $gte: today } }),
      InventoryRecordModel.countDocuments({ scannedAt: { $gte: weekAgo } }),
      InventoryRecordModel.countDocuments({ isOffline: true })
    ]);

    return {
      totalRecords,
      todayRecords,
      thisWeekRecords,
      offlineRecords
    };
  }
}

export default InventoryService;
