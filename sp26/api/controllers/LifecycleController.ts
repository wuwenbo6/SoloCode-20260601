import { Request, Response, NextFunction } from 'express';
import LifecycleService from '../services/LifecycleService.js';
import type { LifecycleLogQueryParams } from '../../shared/types.js';
import type { AuthRequest } from '../middleware/auth.js';

export const createLog = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '请先登录',
        },
      });
      return;
    }

    await LifecycleService.createLog({
      ...req.body,
      performedBy: req.user.userId,
    });

    res.json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

export const getLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const params: LifecycleLogQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      assetUid: req.query.assetUid as string,
      action: req.query.action as string,
      performedBy: req.query.performedBy as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const result = await LifecycleService.getLogs(params);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getLogsByAsset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { uid } = req.params;
    const params: LifecycleLogQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      assetUid: uid,
    };

    const result = await LifecycleService.getLogs(params);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const report = await LifecycleService.getReport(
      startDate as string,
      endDate as string
    );
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

export const exportLogsCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { assetUid, startDate, endDate } = req.query;
    
    const logs = await LifecycleService.getLogsForExport(
      assetUid as string,
      startDate as string,
      endDate as string
    );

    const headers = [
      '操作时间',
      '资产UID',
      '资产名称',
      '操作类型',
      '操作人',
      '备注',
      '原值',
      '新值',
      'GPS纬度',
      'GPS经度',
      '精度',
    ];

    const rows = logs.map((log: any) => [
      new Date(log.performedAt).toLocaleString('zh-CN'),
      log.assetUid,
      log.asset?.name || '',
      getActionLabel(log.action),
      log.user?.name || log.performedBy,
      log.note || '',
      log.oldValue || '',
      log.newValue || '',
      log.location?.gps?.lat || '',
      log.location?.gps?.lng || '',
      log.location?.gps?.accuracy || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const filename = `lifecycle_logs_${Date.now()}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.write('\uFEFF');
    res.write(csvContent);
    res.end();
  } catch (error) {
    next(error);
  }
};

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
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
  return labels[action] || action;
}

export default {
  getLogs,
  getLogsByAsset,
  getReport,
  exportLogsCSV,
};
