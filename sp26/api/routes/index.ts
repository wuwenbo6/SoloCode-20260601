import { Router, type Request, type Response } from 'express';
import authRoutes from './auth.js';
import assetRoutes from './assets.js';
import inventoryRoutes from './inventory.js';
import locationRoutes from './location.js';
import offlineRoutes from './offline.js';
import lifecycleRoutes from './lifecycle.js';
import csvRoutes from './csv.js';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ok'
  });
});

router.use('/auth', authRoutes);
router.use('/assets', assetRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/location', locationRoutes);
router.use('/offline', offlineRoutes);
router.use('/lifecycle', lifecycleRoutes);
router.use('/csv', csvRoutes);

export default router;
