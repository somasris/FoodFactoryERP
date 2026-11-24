import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { usersRouter } from '../modules/users/users.routes';

export const apiRouter: Router = Router();

// Mount health routes under /api/v1/health
apiRouter.use('/health', healthRouter);

// Mount authentication routes under /api/v1/auth
apiRouter.use('/auth', authRouter);

// Mount user management routes under /api/v1/users
apiRouter.use('/users', usersRouter);
