import { Router } from 'express';
import authRoutes from './auth.routes';
import workspaceRoutes from './workspace.routes';
import containerRoutes from './container.routes';
import chatRoutes from './chat.routes';
import fileRoutes from './file.routes';
import opencodeRoutes from './opencode.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/containers', containerRoutes);
router.use('/chat', chatRoutes);
router.use('/files', fileRoutes);
router.use('/opencode', opencodeRoutes);

export default router;
