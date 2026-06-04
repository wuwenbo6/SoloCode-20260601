import { Router } from 'express';
import OfflineSyncController from '../controllers/OfflineSyncController.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { offlineSyncSchema } from '../validations/inventory.js';

const router = Router();

router.use(authMiddleware);

router.post('/sync', validate(offlineSyncSchema), OfflineSyncController.sync);

export default router;
