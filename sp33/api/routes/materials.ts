import { Router } from 'express';
import { materialController } from '../controllers/MaterialController.js';

const router = Router();

router.get('/', materialController.getMaterials.bind(materialController));
router.get('/:id', materialController.getMaterial.bind(materialController));
router.post('/', materialController.createMaterial.bind(materialController));
router.put('/:id', materialController.updateMaterial.bind(materialController));
router.delete('/:id', materialController.deleteMaterial.bind(materialController));

export default router;
