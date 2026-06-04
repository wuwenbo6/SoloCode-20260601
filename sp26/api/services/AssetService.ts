import AssetModel from '../models/Asset.js';
import { AppError } from '../middleware/errorHandler.js';
import type { 
  Asset, 
  CreateAssetRequest, 
  UpdateAssetRequest, 
  PaginationParams, 
  PaginatedResponse,
  BatchStatusUpdateRequest,
  AssetStatus 
} from '../../shared/types.js';
import logger from '../lib/logger.js';

export class AssetService {
  static async getAssets(params: PaginationParams): Promise<PaginatedResponse<Asset>> {
    const { page = 1, limit = 10, search, status, category } = params;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (status) {
      filter.status = status;
    }

    if (category) {
      filter.category = category;
    }

    const [items, total] = await Promise.all([
      AssetModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AssetModel.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: items as unknown as Asset[],
      total,
      page,
      limit,
      totalPages
    };
  }

  static async getAssetByUid(uid: string): Promise<Asset | null> {
    const asset = await AssetModel.findOne({ uid }).lean();
    return asset as unknown as Asset | null;
  }

  static async createAsset(data: CreateAssetRequest): Promise<Asset> {
    const existingAsset = await AssetModel.findOne({ uid: data.uid });
    if (existingAsset) {
      throw new AppError('资产UID已存在', 409, 'DUPLICATE_UID');
    }

    const asset = new AssetModel(data);
    await asset.save();

    logger.info(`Asset created: ${data.uid} - ${data.name}`);

    return asset.toJSON() as unknown as Asset;
  }

  static async updateAsset(uid: string, data: UpdateAssetRequest): Promise<Asset> {
    const asset = await AssetModel.findOne({ uid });
    if (!asset) {
      throw new AppError('资产不存在', 404, 'ASSET_NOT_FOUND');
    }

    Object.assign(asset, data);
    await asset.save();

    logger.info(`Asset updated: ${uid}`);

    return asset.toJSON() as unknown as Asset;
  }

  static async deleteAsset(uid: string): Promise<void> {
    const result = await AssetModel.deleteOne({ uid });
    if (result.deletedCount === 0) {
      throw new AppError('资产不存在', 404, 'ASSET_NOT_FOUND');
    }

    logger.info(`Asset deleted: ${uid}`);
  }

  static async batchUpdateStatus(request: BatchStatusUpdateRequest): Promise<{ updated: number }> {
    const { uids, status } = request;

    const result = await AssetModel.updateMany(
      { uid: { $in: uids } },
      { $set: { status } }
    );

    logger.info(`Batch status updated: ${result.modifiedCount} assets to ${status}`);

    return { updated: result.modifiedCount };
  }

  static async updateLastInventory(uid: string, scannedAt: string): Promise<void> {
    await AssetModel.updateOne(
      { uid },
      { $set: { lastInventoryAt: scannedAt } }
    );
  }

  static async getCategories(): Promise<string[]> {
    const categories = await AssetModel.distinct('category');
    return categories.filter(Boolean);
  }

  static async getStats(): Promise<{
    total: number;
    byStatus: Record<AssetStatus, number>;
    byCategory: Record<string, number>;
  }> {
    const [total, byStatus, byCategory] = await Promise.all([
      AssetModel.countDocuments(),
      AssetModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      AssetModel.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
    ]);

    const statusCounts: Record<AssetStatus, number> = {
      in_use: 0,
      idle: 0,
      maintenance: 0,
      scrapped: 0
    };

    byStatus.forEach((item: { _id: AssetStatus; count: number }) => {
      if (item._id in statusCounts) {
        statusCounts[item._id] = item.count;
      }
    });

    const categoryCounts: Record<string, number> = {};
    byCategory.forEach((item: { _id: string; count: number }) => {
      if (item._id) {
        categoryCounts[item._id] = item.count;
      }
    });

    return {
      total,
      byStatus: statusCounts,
      byCategory: categoryCounts
    };
  }
}

export default AssetService;
