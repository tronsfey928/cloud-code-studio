import { Router } from 'express';
import {
  createSession,
  getSessions,
  getSession,
  sendMessage,
  deleteSession,
} from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/sessions', createSession);
router.get('/sessions', getSessions);
router.get('/sessions/:id', getSession);
router.post('/sessions/:id/messages', sendMessage);
router.delete('/sessions/:id', deleteSession);

export default router;
