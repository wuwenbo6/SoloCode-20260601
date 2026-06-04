import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { loginSchema } from '../validations/auth.js';

const router = Router();

router.post('/login', validate(loginSchema), AuthController.login);
router.get('/me', authMiddleware, AuthController.me);

export default router;
