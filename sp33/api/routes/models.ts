import { Router } from 'express';
import { modelController } from '../controllers/ModelController.js';

const router = Router();

router.get('/', modelController.getModels.bind(modelController));
router.get('/:name', modelController.getModel.bind(modelController));
router.post('/', modelController.uploadModel.bind(modelController));

export default router;
