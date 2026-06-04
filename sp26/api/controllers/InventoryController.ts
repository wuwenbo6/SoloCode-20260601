import type { Response, NextFunction } from 'express';
import InventoryService from '../services/InventoryService.js';
import LifecycleService from '../services/LifecycleService.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { 
  ApiResponse, 
  InventoryRecord, 
  PaginatedResponse,
  BatchInventoryRequest,
  LocationData,
} from '../../shared/types.js';

export class InventoryController {
  static async createRecord(
    req: AuthRequest,
    res: Response<ApiResponse<InventoryRecord>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '请先登录'
          }
        });
        return;
      }

      const recordData = {
        ...req.body,
        scannedBy: req.user.userId
      };

      const record = await InventoryService.createRecord(recordData);
      
      if (req.user?.userId) {
        const { location, status, note } = req.body as { 
          location?: LocationData; 
          status?: string;
          note?: string;
        };
        LifecycleService.createLog({
          assetUid: recordData.assetUid,
          action: 'inventory',
          performedBy: req.user.userId,
          location,
          note,
          newValue: status,
        }).catch(err => console.error('Failed to log inventory:', err));
      }
      
      res.status(201).json({
        success: true,
        data: record
      });
    } catch (error) {
      next(error);
    }
  }

  static async batchCreateRecords(
    req: AuthRequest,
    res: Response<ApiResponse<{ created: number; failed: string[] }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '请先登录'
          }
        });
        return;
      }

      const body = req.body as BatchInventoryRequest;
      const result = await InventoryService.batchCreateRecords(
        body,
        req.user.userId,
        false
      );

      if (req.user?.userId && result.created > 0) {
        const logEntries = body.items.map(item => ({
          assetUid: item.uid,
          action: 'inventory' as const,
          performedBy: req.user!.userId,
          location: body.location,
          note: item.note || '批量盘点',
          newValue: item.status,
        }));
        LifecycleService.bulkCreateLogs(logEntries)
          .catch(err => console.error('Failed to log batch inventory:', err));
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRecords(
    req: AuthRequest,
    res: Response<ApiResponse<PaginatedResponse<InventoryRecord>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await InventoryService.getRecords(req.query);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(
    req: AuthRequest,
    res: Response<ApiResponse<{
      totalRecords: number;
      todayRecords: number;
      thisWeekRecords: number;
      offlineRecords: number;
    }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await InventoryService.getInventoryStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export default InventoryController;
