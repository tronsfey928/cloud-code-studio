import { Router } from 'express';
import {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  deleteWorkspace,
  startWorkspace,
  stopWorkspace,
} from '../controllers/workspace.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', createWorkspace);
router.get('/', listWorkspaces);
router.get('/:id', getWorkspace);
router.delete('/:id', deleteWorkspace);
router.post('/:id/start', startWorkspace);
router.post('/:id/stop', stopWorkspace);

export default router;
