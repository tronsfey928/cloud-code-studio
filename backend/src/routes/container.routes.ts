import { Router } from 'express';
import {
  getContainerStatus,
  startContainer,
  stopContainer,
  getContainerLogs,
  execInContainer,
} from '../controllers/container.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/:workspaceId/status', getContainerStatus);
router.post('/:workspaceId/start', startContainer);
router.post('/:workspaceId/stop', stopContainer);
router.get('/:workspaceId/logs', getContainerLogs);
router.post('/:workspaceId/exec', execInContainer);

export default router;
