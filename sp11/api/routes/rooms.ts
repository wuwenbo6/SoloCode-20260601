import { Router } from 'express';
import * as roomController from '../controllers/roomController.js';
import * as versionController from '../controllers/versionController.js';

const router = Router();

router.post('/', roomController.createRoom);
router.get('/ice-servers', roomController.getIceServersConfig);
router.get('/:roomId', roomController.getRoom);
router.post('/:roomId/join', roomController.joinRoom);

router.get('/:roomId/versions', versionController.getVersions);
router.get('/:roomId/versions/:versionId', versionController.getVersion);
router.post('/:roomId/versions', versionController.saveVersion);
router.post('/:roomId/versions/:versionId/restore', versionController.restoreVersion);

export default router;
