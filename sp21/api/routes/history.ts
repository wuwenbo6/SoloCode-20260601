import { Router } from 'express';
import { getHistory, create, getStats } from '../controllers/historyController';

const router = Router();

router.get('/', getHistory);
router.get('/stats', getStats);
router.post('/', create);

export default router;
