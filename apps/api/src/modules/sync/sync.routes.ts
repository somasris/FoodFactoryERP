import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.middleware';
import { validateCsrfProtection } from '../../middleware/csrf.middleware';
import { SyncController } from './sync.controller';

export const syncRouter: Router = Router();

const syncRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Too many synchronization requests. Please wait a moment.',
    timestamp: new Date().toISOString(),
  },
});

syncRouter.use(authenticate);
syncRouter.use(syncRateLimiter);

syncRouter.get('/status', SyncController.status);
syncRouter.post('/push', validateCsrfProtection, SyncController.push);
syncRouter.post('/pull', validateCsrfProtection, SyncController.pull);
syncRouter.get('/operations/:operationId', SyncController.getOperation);
syncRouter.get('/conflicts', SyncController.listConflicts);
syncRouter.post('/conflicts/:conflictId/resolve', validateCsrfProtection, SyncController.resolveConflict);
