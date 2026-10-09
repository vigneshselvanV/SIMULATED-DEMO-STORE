import { Router } from 'express';
import { register, login, logout, getCurrentUser } from '../controllers/authController.js';
import { validateRegistration, validateLogin } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authRateLimiter, validateRegistration, register);
router.post('/login', authRateLimiter, validateLogin, login);
router.post('/logout', logout);
router.get('/me', getCurrentUser);

export default router;
