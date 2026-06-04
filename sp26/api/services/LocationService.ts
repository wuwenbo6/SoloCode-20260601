import LocationHistoryModel from '../models/LocationHistory.js';
import AssetService from './AssetService.js';
import { AppError } from '../middleware/errorHandler.js';
import type { LocationTrack, PaginatedResponse } from '../../shared/types.js';
import logger from '../lib/logger.js';

export interface GetLocationHistoryParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export class LocationService {
  static async trackLocation(data: Omit<LocationTrack, '_id' | 'asset'>): Promise<LocationTrack> {
    const asset = await AssetService.getAssetByUid(data.assetUid);
    if (!asset) {
      throw new AppError('资产不存在', 404, 'ASSET_NOT_FOUND');
    }

    const locationTrack = new LocationHistoryModel(data);
    await locationTrack.save();

    logger.info(`Location tracked: ${data.assetUid} at ${data.gps.lat}, ${data.gps.lng}`);

    const result = await LocationHistoryModel.findById(locationTrack._id)
      .populate('asset')
      .lean();

    return result as unknown as LocationTrack;
  }

  static async getLocationHistory(
    assetUid: string,
    params: GetLocationHistoryParams
  ): Promise<PaginatedResponse<LocationTrack>> {
    const { page = 1, limit = 20, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { assetUid };

    if (startDate || endDate) {
      filter.trackedAt = {};
      if (startDate) {
        (filter.trackedAt as Record<string, unknown>).$gte = startDate;
      }
      if (endDate) {
        (filter.trackedAt as Record<string, unknown>).$lte = endDate;
      }
    }

    const [items, total] = await Promise.all([
      LocationHistoryModel.find(filter)
        .sort({ trackedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('asset')
        .lean(),
      LocationHistoryModel.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: items as unknown as LocationTrack[],
      total,
      page,
      limit,
      totalPages
    };
  }

  static async getLatestLocation(assetUid: string): Promise<LocationTrack | null> {
    const location = await LocationHistoryModel.findOne({ assetUid })
      .sort({ trackedAt: -1 })
      .populate('asset')
      .lean();

    return location as unknown as LocationTrack | null;
  }

  static async deleteOldRecords(beforeDate: string): Promise<{ deleted: number }> {
    const result = await LocationHistoryModel.deleteMany({ trackedAt: { $lt: beforeDate } });
    logger.info(`Deleted ${result.deletedCount} old location records`);
    return { deleted: result.deletedCount };
  }
}

export default LocationService;
