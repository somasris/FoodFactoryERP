import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { usersRouter } from '../modules/users/users.routes';
import { masterDataRouter } from '../modules/master-data/master-data.routes';
import { inventoryRouter } from '../modules/inventory/inventory.routes';
import { salesRouter } from '../modules/sales/sales.routes';
import { productionRouter } from '../modules/production/production.routes';

export const apiRouter: Router = Router();

// Mount health routes under /api/v1/health
apiRouter.use('/health', healthRouter);

// Mount authentication routes under /api/v1/auth
apiRouter.use('/auth', authRouter);

// Mount user management routes under /api/v1/users
apiRouter.use('/users', usersRouter);

// Mount Phase 1.4 Master Data Management routes under /api/v1/master-data
apiRouter.use('/master-data', masterDataRouter);

// Mount Phase 1.5 Stage 3 Inventory Management routes under /api/v1/inventory
apiRouter.use('/inventory', inventoryRouter);

// Mount Phase 2 Sales & Orders routes under /api/v1/sales
apiRouter.use('/sales', salesRouter);

// Mount Phase 3 Production routes (BOMs & Planning) under /api/v1/production
apiRouter.use('/production', productionRouter);
