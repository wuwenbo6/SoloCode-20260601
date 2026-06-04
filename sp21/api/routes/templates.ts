import { Router } from 'express';
import {
  getTemplates,
  getTemplate,
  create,
  update,
  remove
} from '../controllers/templateController';

const router = Router();

router.get('/', getTemplates);
router.get('/:id', getTemplate);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
