import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { usersRouter } from '../modules/users/users.routes';
import { masterDataRouter } from '../modules/master-data/master-data.routes';
import { inventoryRouter } from '../modules/inventory/inventory.routes';
import { salesRouter } from '../modules/sales/sales.routes';
import { purchasesRouter } from '../modules/purchases/purchases.routes';
import { productionRouter } from '../modules/production/production.routes';
import { adminRouter } from '../modules/admin/admin.routes';
import { complianceRouter } from '../modules/compliance/compliance.routes';
import { reportsRouter } from '../modules/reports/reports.routes';
import { governanceRouter } from '../modules/governance/governance.routes';
import { operationsRouter } from '../modules/operations/operations.routes';
import { notificationRouter } from '../modules/notifications/notification.routes';
import { warehouseRouter } from '../modules/warehouse/warehouse.routes';
import { syncRouter } from '../modules/sync/sync.routes';
import { searchRouter } from '../modules/search/search.routes';
import { labelRouter } from '../modules/labels/label.routes';
import {
  activityTimelineRouter,
  preferencesRouter,
  savedViewsRouter,
} from '../modules/ux/ux.routes';
import { manufacturingIntelligenceRouter } from '../modules/manufacturing-intelligence/mi.routes';
import { collaborationRouter } from '../modules/collaboration/collaboration.routes';

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

// Mount P0.3 Supplier Purchase Invoices & Purchase Register routes under /api/v1/purchases
apiRouter.use('/purchases', purchasesRouter);

// Mount Phase 3 Production routes (BOMs & Planning) under /api/v1/production
apiRouter.use('/production', productionRouter);

// Mount Phase 4.1 System Administration routes under /api/v1/admin
apiRouter.use('/admin', adminRouter);

// Mount Phase 4.2 Financial & Compliance routes under /api/v1/compliance
apiRouter.use('/compliance', complianceRouter);

// Mount Phase 4.3 Business Intelligence & Reports routes under /api/v1/reports
apiRouter.use('/reports', reportsRouter);

// Mount Phase 4.4 Audit & Governance routes under /api/v1/governance
apiRouter.use('/governance', governanceRouter);

// Mount Phase 4.5 System Reliability & Operations routes under /api/v1/operations
apiRouter.use('/operations', operationsRouter);

// Mount Enterprise Notification System routes under /api/v1/notifications
apiRouter.use('/notifications', notificationRouter);

// Mount Phase 9 Smart Warehouse, Bin Locations & Barcode Operations under /api/v1/warehouse
apiRouter.use('/warehouse', warehouseRouter);

// Mount Offline PWA Synchronization API under /api/v1/sync
apiRouter.use('/sync', syncRouter);

// Mount Global Command Center Search API under /api/v1/search
apiRouter.use('/search', searchRouter);

// Mount Phase 8 Smart Batch Label Designer API under /api/v1/labels
apiRouter.use('/labels', labelRouter);

// Mount Phase 5 Smart UX routes
apiRouter.use('/preferences', preferencesRouter);
apiRouter.use('/saved-views', savedViewsRouter);
apiRouter.use('/activity-timeline', activityTimelineRouter);

// Mount Phase 6 Manufacturing Intelligence routes
apiRouter.use('/manufacturing-intelligence', manufacturingIntelligenceRouter);

// Mount Phase 7 Factory Collaboration & Decision Support routes
apiRouter.use('/collaboration', collaborationRouter);
