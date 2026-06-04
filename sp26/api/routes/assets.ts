import { Router } from 'express';
import AssetController from '../controllers/AssetController.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  createAssetSchema,
  updateAssetSchema,
  batchStatusUpdateSchema,
  getAssetsQuerySchema
} from '../validations/asset.js';

const router = Router();

router.use(authMiddleware);

router.get('/', validate(getAssetsQuerySchema, 'query'), AssetController.getAssets);
router.get('/categories', AssetController.getCategories);
router.get('/stats', AssetController.getStats);
router.get('/:uid', AssetController.getAssetByUid);
router.post('/', requireRole(['admin']), validate(createAssetSchema), AssetController.createAsset);
router.put('/:uid', requireRole(['admin']), validate(updateAssetSchema), AssetController.updateAsset);
router.delete('/:uid', requireRole(['admin']), AssetController.deleteAsset);
router.put('/batch/status', requireRole(['admin']), validate(batchStatusUpdateSchema), AssetController.batchUpdateStatus);

export default router;
