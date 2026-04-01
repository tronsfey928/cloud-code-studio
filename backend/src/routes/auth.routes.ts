import { Router } from 'express';
import { register, login, getMe, changePassword, refreshAccessToken, logout } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.put('/me/password', authenticate, changePassword);

export default router;
