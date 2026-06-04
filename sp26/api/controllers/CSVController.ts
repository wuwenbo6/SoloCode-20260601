import { Request, Response, NextFunction } from 'express';
import AssetService from '../services/AssetService.js';
import LifecycleService from '../services/LifecycleService.js';
import type { CreateAssetRequest, Asset } from '../../shared/types.js';

export const exportAssetsCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, category } = req.query;
    
    const assets = await AssetService.getAll({
      status: status as string,
      category: category as string,
      limit: 9999,
    });

    const headers = [
      'UID',
      '资产名称',
      '分类',
      '位置',
      '状态',
      '描述',
      '图片URL',
      '采购日期',
      '采购价格',
      '最近盘点时间',
      '创建时间',
      '更新时间',
    ];

    const statusLabels: Record<string, string> = {
      in_use: '在用',
      idle: '闲置',
      maintenance: '维修中',
      scrapped: '报废',
    };

    const rows = (assets.items as Asset[]).map((asset: Asset) => [
      asset.uid,
      asset.name,
      asset.category,
      asset.location,
      statusLabels[asset.status] || asset.status,
      asset.description || '',
      asset.imageUrl || '',
      asset.purchaseDate || '',
      asset.purchasePrice || '',
      asset.lastInventoryAt || '',
      new Date(asset.createdAt).toLocaleString('zh-CN'),
      new Date(asset.updatedAt).toLocaleString('zh-CN'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const filename = `assets_${Date.now()}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.write('\uFEFF');
    res.write(csvContent);
    res.end();

    if (req.user?.id) {
      await LifecycleService.createLog({
        assetUid: 'BULK_EXPORT',
        action: 'export',
        performedBy: req.user.id,
        note: `导出 ${rows.length} 条资产记录`,
        metadata: { count: rows.length, filters: { status, category } },
      });
    }
  } catch (error) {
    next(error);
  }
};

export const importAssetsCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: 'CSV数据格式不正确',
        },
      });
      return;
    }

    const statusMap: Record<string, string> = {
      '在用': 'in_use',
      '闲置': 'idle',
      '维修中': 'maintenance',
      '报废': 'scrapped',
    };

    const results = {
      success: [] as string[],
      failed: [] as { row: number; error: string; data: unknown }[],
    };

    const logEntries = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        if (!row.uid || !row.name || !row.category || !row.location || !row.status) {
          throw new Error('缺少必填字段');
        }

        const statusKey = statusMap[row.status] || row.status;
        if (!['in_use', 'idle', 'maintenance', 'scrapped'].includes(statusKey)) {
          throw new Error(`无效的状态值: ${row.status}`);
        }

        const assetData: CreateAssetRequest = {
          uid: String(row.uid).trim(),
          name: String(row.name).trim(),
          category: String(row.category).trim(),
          location: String(row.location).trim(),
          status: statusKey as any,
          description: row.description ? String(row.description).trim() : undefined,
          imageUrl: row.imageUrl ? String(row.imageUrl).trim() : undefined,
          purchaseDate: row.purchaseDate ? String(row.purchaseDate).trim() : undefined,
          purchasePrice: row.purchasePrice ? Number(row.purchasePrice) : undefined,
        };

        let asset;
        try {
          asset = await AssetService.getByUid(assetData.uid);
          if (asset) {
            asset = await AssetService.update(assetData.uid, assetData);
          }
        } catch {
          asset = await AssetService.create(assetData);
        }

        results.success.push(assetData.uid);

        if (req.user?.id) {
          logEntries.push({
            assetUid: assetData.uid,
            action: 'import' as const,
            performedBy: req.user.id,
            note: '批量导入',
            metadata: { row: i + 1, isNew: !asset },
          });
        }
      } catch (error) {
        results.failed.push({
          row: i + 1,
          error: error instanceof Error ? error.message : '未知错误',
          data: row,
        });
      }
    }

    if (logEntries.length > 0) {
      await LifecycleService.bulkCreateLogs(logEntries);
    }

    res.json({
      success: true,
      data: {
        total: data.length,
        success: results.success.length,
        failed: results.failed.length,
        successItems: results.success,
        failedItems: results.failed,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  exportAssetsCSV,
  importAssetsCSV,
};
