import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { ReportsController } from './reports.controller';

export const reportsRouter: Router = Router();

reportsRouter.use(authenticate);

reportsRouter.get(
  '/executive-dashboard',
  requirePermissions('analytics.dashboard.read'),
  ReportsController.executiveDashboard,
);
reportsRouter.get(
  '/sales',
  requirePermissions('analytics.sales.read'),
  ReportsController.salesAnalytics,
);
reportsRouter.get(
  '/inventory',
  requirePermissions('analytics.inventory.read'),
  ReportsController.inventoryAnalytics,
);
reportsRouter.get(
  '/production',
  requirePermissions('analytics.production.read'),
  ReportsController.productionAnalytics,
);
reportsRouter.get(
  '/profitability',
  requirePermissions('analytics.profitability.read'),
  ReportsController.profitability,
);
reportsRouter.get(
  '/factory-performance',
  requirePermissions('analytics.factory.read'),
  ReportsController.factoryPerformance,
);
reportsRouter.get(
  '/export/:reportType',
  requirePermissions('analytics.export'),
  ReportsController.exportAnalytics,
);

