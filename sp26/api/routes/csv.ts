import { Router } from 'express';
import {
  exportAssetsCSV,
  importAssetsCSV,
} from '../controllers/CSVController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/export', auth, exportAssetsCSV);
router.post('/import', auth, importAssetsCSV);

export default router;
