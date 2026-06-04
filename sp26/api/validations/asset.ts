import { z } from 'zod';
import type { AssetStatus } from '../../shared/types.js';

const assetStatusEnum: [AssetStatus, ...AssetStatus[]] = ['in_use', 'idle', 'maintenance', 'scrapped'];

export const createAssetSchema = z.object({
  uid: z.string().min(1, '资产UID不能为空'),
  name: z.string().min(1, '资产名称不能为空'),
  category: z.string().min(1, '资产分类不能为空'),
  location: z.string().min(1, '存放位置不能为空'),
  status: z.enum(assetStatusEnum),
  description: z.string().optional(),
  imageUrl: z.string().url('请输入有效的图片URL').optional().or(z.literal('')),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().positive('购买价格必须为正数').optional()
});

export const updateAssetSchema = z.object({
  name: z.string().min(1, '资产名称不能为空').optional(),
  category: z.string().min(1, '资产分类不能为空').optional(),
  location: z.string().min(1, '存放位置不能为空').optional(),
  status: z.enum(assetStatusEnum).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url('请输入有效的图片URL').optional().or(z.literal('')),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().positive('购买价格必须为正数').optional()
});

export const batchStatusUpdateSchema = z.object({
  uids: z.array(z.string()).min(1, '至少选择一个资产'),
  status: z.enum(assetStatusEnum),
  note: z.string().optional()
});

export const getAssetsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: z.enum(assetStatusEnum).optional(),
  category: z.string().optional()
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type BatchStatusUpdateInput = z.infer<typeof batchStatusUpdateSchema>;
export type GetAssetsQueryInput = z.infer<typeof getAssetsQuerySchema>;
