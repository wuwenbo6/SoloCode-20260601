import type { Response, NextFunction } from 'express';
import OfflineSyncService from '../services/OfflineSyncService.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { ApiResponse, SyncQueueItem } from '../../shared/types.js';

export class OfflineSyncController {
  static async sync(
    req: AuthRequest,
    res: Response<ApiResponse<{ success: number; failed: number; errors: Array<{ id: string; error: string }> }>>,
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

      const { items } = req.body as { items: SyncQueueItem[] };

      const validation = OfflineSyncService.validateSyncData(items);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '同步数据验证失败',
            details: validation.errors
          }
        });
        return;
      }

      const result = await OfflineSyncService.sync(items, req.user.userId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export default OfflineSyncController;
