import type { Response, NextFunction } from 'express';
import AssetService from '../services/AssetService.js';
import LifecycleService from '../services/LifecycleService.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { 
  ApiResponse, 
  Asset, 
  PaginatedResponse,
  CreateAssetRequest,
  UpdateAssetRequest,
  BatchStatusUpdateRequest,
  LocationData,
} from '../../shared/types.js';

export class AssetController {
  static async getAssets(
    req: AuthRequest,
    res: Response<ApiResponse<PaginatedResponse<Asset>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await AssetService.getAssets(req.query);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAssetByUid(
    req: AuthRequest,
    res: Response<ApiResponse<Asset>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { uid } = req.params;
      const asset = await AssetService.getAssetByUid(uid);
      
      if (!asset) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ASSET_NOT_FOUND',
            message: '资产不存在'
          }
        });
        return;
      }

      if (req.user?.userId) {
        const { location, note } = req.body as { location?: LocationData; note?: string };
        LifecycleService.createLog({
          assetUid: uid,
          action: 'scan',
          performedBy: req.user.userId,
          location,
          note,
        }).catch(err => console.error('Failed to log scan:', err));
      }

      res.json({
        success: true,
        data: asset
      });
    } catch (error) {
      next(error);
    }
  }

  static async createAsset(
    req: AuthRequest,
    res: Response<ApiResponse<Asset>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = req.body as CreateAssetRequest;
      const asset = await AssetService.createAsset(body);
      
      if (req.user?.userId) {
        LifecycleService.createLog({
          assetUid: body.uid,
          action: 'create',
          performedBy: req.user.userId,
          note: '创建资产',
          newValue: body.name,
        }).catch(err => console.error('Failed to log create:', err));
      }
      
      res.status(201).json({
        success: true,
        data: asset
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAsset(
    req: AuthRequest,
    res: Response<ApiResponse<Asset>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { uid } = req.params;
      const body = req.body as UpdateAssetRequest;
      
      const oldAsset = await AssetService.getAssetByUid(uid);
      const asset = await AssetService.updateAsset(uid, body);
      
      if (req.user?.userId) {
        const changes: string[] = [];
        let oldStatus = oldAsset?.status;
        let newStatus = body.status;
        
        if (body.status && oldAsset?.status !== body.status) {
          changes.push(`状态: ${oldAsset.status} → ${body.status}`);
          LifecycleService.createLog({
            assetUid: uid,
            action: 'status_change',
            performedBy: req.user.userId,
            oldValue: oldAsset.status,
            newValue: body.status,
          }).catch(err => console.error('Failed to log status change:', err));
        }
        
        if (body.location && oldAsset?.location !== body.location) {
          changes.push(`位置: ${oldAsset?.location} → ${body.location}`);
          LifecycleService.createLog({
            assetUid: uid,
            action: 'location_update',
            performedBy: req.user.userId,
            oldValue: oldAsset?.location,
            newValue: body.location,
          }).catch(err => console.error('Failed to log location update:', err));
        }
        
        if (changes.length > 0 || Object.keys(body).length > 0) {
          LifecycleService.createLog({
            assetUid: uid,
            action: 'update',
            performedBy: req.user.userId,
            note: changes.length > 0 ? changes.join(', ') : '更新资产信息',
            oldValue: oldStatus,
            newValue: newStatus || oldStatus,
          }).catch(err => console.error('Failed to log update:', err));
        }
      }
      
      res.json({
        success: true,
        data: asset
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAsset(
    req: AuthRequest,
    res: Response<ApiResponse<void>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { uid } = req.params;
      const oldAsset = await AssetService.getAssetByUid(uid);
      await AssetService.deleteAsset(uid);
      
      if (req.user?.userId) {
        LifecycleService.createLog({
          assetUid: uid,
          action: 'delete',
          performedBy: req.user.userId,
          note: '删除资产',
          oldValue: oldAsset?.name,
        }).catch(err => console.error('Failed to log delete:', err));
      }
      
      res.json({
        success: true
      });
    } catch (error) {
      next(error);
    }
  }

  static async batchUpdateStatus(
    req: AuthRequest,
    res: Response<ApiResponse<{ updated: number }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = req.body as BatchStatusUpdateRequest;
      const result = await AssetService.batchUpdateStatus(body);
      
      if (req.user?.userId) {
        const logEntries = body.uids.map(uid => ({
          assetUid: uid,
          action: 'status_change' as const,
          performedBy: req.user!.userId,
          oldValue: undefined,
          newValue: body.status,
          note: body.note || '批量更新状态',
        }));
        LifecycleService.bulkCreateLogs(logEntries)
          .catch(err => console.error('Failed to log batch status update:', err));
      }
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCategories(
    req: AuthRequest,
    res: Response<ApiResponse<string[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const categories = await AssetService.getCategories();
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(
    req: AuthRequest,
    res: Response<ApiResponse<{
      total: number;
      byStatus: Record<string, number>;
      byCategory: Record<string, number>;
    }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await AssetService.getStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AssetController;
