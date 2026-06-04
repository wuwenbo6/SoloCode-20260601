import { Router } from 'express';
import {
  createLog,
  getLogs,
  getLogsByAsset,
  getReport,
  exportLogsCSV,
} from '../controllers/LifecycleController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.post('/', auth, createLog);
router.get('/', auth, getLogs);
router.get('/report', auth, getReport);
router.get('/export', auth, exportLogsCSV);
router.get('/asset/:uid', auth, getLogsByAsset);

export default router;
