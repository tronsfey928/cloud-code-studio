import { Router } from 'express';
import {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  deleteWorkspace,
} from '../controllers/workspace.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', createWorkspace);
router.get('/', listWorkspaces);
router.get('/:id', getWorkspace);
router.delete('/:id', deleteWorkspace);

export default router;
