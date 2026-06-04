import { Router } from 'express';
import LocationController from '../controllers/LocationController.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  locationTrackSchema,
  getLocationHistoryQuerySchema
} from '../validations/location.js';

const router = Router();

router.use(authMiddleware);

router.post('/track', validate(locationTrackSchema), LocationController.trackLocation);
router.get('/history/:assetUid', validate(getLocationHistoryQuerySchema, 'query'), LocationController.getLocationHistory);
router.get('/latest/:assetUid', LocationController.getLatestLocation);

export default router;
