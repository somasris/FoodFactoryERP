import { Router } from 'express';
import { healthRouter } from './health.routes';

export const apiRouter: Router = Router();

// Mount health routes under /api/v1/health
apiRouter.use('/health', healthRouter);
