import { Router } from 'express';
import InventoryController from '../controllers/InventoryController.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  inventoryRecordSchema,
  batchInventorySchema,
  getInventoryRecordsQuerySchema
} from '../validations/inventory.js';

const router = Router();

router.use(authMiddleware);

router.get('/records', validate(getInventoryRecordsQuerySchema, 'query'), InventoryController.getRecords);
router.get('/stats', InventoryController.getStats);
router.post('/records', validate(inventoryRecordSchema), InventoryController.createRecord);
router.post('/batch', validate(batchInventorySchema), InventoryController.batchCreateRecords);

export default router;
