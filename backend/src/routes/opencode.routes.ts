import { Router } from 'express';
import { getConfig, updateConfig } from '../controllers/opencode.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/:workspaceId/config', getConfig);
router.put('/:workspaceId/config', updateConfig);

export default router;
