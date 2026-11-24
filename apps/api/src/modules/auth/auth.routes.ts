import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

export const authRouter = Router();

// Strict rate limiter for login attempts: 10 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    timestamp: new Date().toISOString(),
  },
});

// Rate limiter for token refreshes: 30 requests per 15 minutes
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many token refresh attempts. Please try again shortly.',
    timestamp: new Date().toISOString(),
  },
});

authRouter.post('/login', loginLimiter, AuthController.login);
authRouter.post('/refresh', refreshLimiter, AuthController.refresh);
authRouter.post('/logout', AuthController.logout);
authRouter.post('/logout-all', authenticate, AuthController.logoutAll);
authRouter.get('/me', authenticate, AuthController.me);
