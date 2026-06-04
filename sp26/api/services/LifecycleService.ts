import AssetLifecycleLog from '../models/AssetLifecycleLog.js';
import Asset from '../models/Asset.js';
import User from '../models/User.js';
import type { 
  LifecycleAction, 
  LocationData, 
  LifecycleLogQueryParams,
  ReportData,
  AssetStatus,
} from '../../shared/types.js';

interface CreateLogParams {
  assetUid: string;
  action: LifecycleAction;
  performedBy: string;
  location?: LocationData;
  note?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}

export class LifecycleService {
  static async createLog(params: CreateLogParams): Promise<void> {
    const {
      assetUid,
      action,
      performedBy,
      location,
      note,
      oldValue,
      newValue,
      metadata,
    } = params;

    await AssetLifecycleLog.create({
      assetUid,
      action,
      performedBy,
      location,
      note,
      oldValue,
      newValue,
      metadata,
      performedAt: new Date(),
    });
  }

  static async bulkCreateLogs(logs: CreateLogParams[]): Promise<void> {
    if (logs.length === 0) return;
    
    const documents = logs.map(log => ({
      ...log,
      performedAt: new Date(),
    }));
    
    await AssetLifecycleLog.insertMany(documents);
  }

  static async getLogs(params: LifecycleLogQueryParams): Promise<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      assetUid,
      action,
      performedBy,
      startDate,
      endDate,
    } = params;

    const query: Record<string, unknown> = {};
    
    if (assetUid) {
      query.assetUid = assetUid;
    }
    
    if (action) {
      query.action = action;
    }
    
    if (performedBy) {
      query.performedBy = performedBy;
    }
    
    if (startDate || endDate) {
      query.performedAt = {};
      if (startDate) {
        (query.performedAt as Record<string, unknown>).$gte = new Date(startDate);
      }
      if (endDate) {
        (query.performedAt as Record<string, unknown>).$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      AssetLifecycleLog.find(query)
        .sort({ performedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'asset',
          model: 'Asset',
          localField: 'assetUid',
          foreignField: 'uid',
        })
        .populate({
          path: 'user',
          model: 'User',
          localField: 'performedBy',
          foreignField: '_id',
        })
        .lean(),
      AssetLifecycleLog.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: logs,
      total,
      page,
      limit,
      totalPages,
    };
  }

  static async getReport(startDate?: string, endDate?: string): Promise<ReportData> {
    const start = startDate ? new Date(startDate) : 
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const match = {
      performedAt: {
        $gte: start,
        $lte: end,
      },
    };

    const [
      totalScans,
      totalInventory,
      statusChanges,
      locationUpdates,
      byAction,
      byUser,
      byStatus,
    ] = await Promise.all([
      AssetLifecycleLog.countDocuments({ ...match, action: 'scan' }),
      AssetLifecycleLog.countDocuments({ ...match, action: 'inventory' }),
      AssetLifecycleLog.countDocuments({ ...match, action: 'status_change' }),
      AssetLifecycleLog.countDocuments({ ...match, action: 'location_update' }),
      AssetLifecycleLog.aggregate([
        { $match: match },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AssetLifecycleLog.aggregate([
        { $match: match },
        { $group: { _id: '$performedBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AssetLifecycleLog.aggregate([
        { $match: { ...match, action: 'status_change' } },
        { $group: { _id: '$newValue', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const users = await User.find({
      _id: { $in: byUser.map(u => u._id) },
    }).select('_id name').lean();

    const userMap = new Map(users.map(u => [u._id.toString(), u.name]));

    return {
      totalScans,
      totalInventory,
      statusChanges,
      locationUpdates,
      byAction: byAction.map(a => ({
        action: a._id as LifecycleAction,
        count: a.count,
      })),
      byUser: byUser.map(u => ({
        userId: u._id,
        userName: userMap.get(u._id) || '未知用户',
        count: u.count,
      })),
      byStatus: byStatus.map(s => ({
        status: s._id as AssetStatus,
        count: s.count,
      })),
      byLocation: [],
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  static async getLogsForExport(
    assetUid?: string,
    startDate?: string,
    endDate?: string
  ): Promise<unknown[]> {
    const query: Record<string, unknown> = {};
    
    if (assetUid) {
      query.assetUid = assetUid;
    }
    
    if (startDate || endDate) {
      query.performedAt = {};
      if (startDate) {
        (query.performedAt as Record<string, unknown>).$gte = new Date(startDate);
      }
      if (endDate) {
        (query.performedAt as Record<string, unknown>).$lte = new Date(endDate);
      }
    }

    const logs = await AssetLifecycleLog.find(query)
      .sort({ performedAt: -1 })
      .populate({
        path: 'asset',
        model: 'Asset',
        localField: 'assetUid',
        foreignField: 'uid',
      })
      .populate({
        path: 'user',
        model: 'User',
        localField: 'performedBy',
        foreignField: '_id',
      })
      .lean();

    return logs;
  }
}

export default LifecycleService;
