import { Router } from 'express';
import {
  getFileTree,
  readFile,
  writeFile,
  uploadFile,
} from '../controllers/file.controller';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/:workspaceId/tree', getFileTree);
router.get('/:workspaceId/read', readFile);
router.put('/:workspaceId/write', writeFile);
router.post('/:workspaceId/upload', upload.single('file'), uploadFile);

export default router;
