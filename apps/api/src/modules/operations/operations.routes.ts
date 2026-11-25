import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { OperationsController } from './operations.controller';

export const operationsRouter: Router = Router();

operationsRouter.use(authenticate);

operationsRouter.get(
  '/health',
  requirePermissions('operations.health.read'),
  OperationsController.getHealth,
);
operationsRouter.get(
  '/monitoring',
  requirePermissions('operations.monitoring.read'),
  OperationsController.getMonitoring,
);
operationsRouter.get(
  '/database',
  requirePermissions('operations.health.read'),
  OperationsController.getDatabaseInfo,
);
operationsRouter.get(
  '/backups',
  requirePermissions('operations.backup.read'),
  OperationsController.listBackups,
);
operationsRouter.post(
  '/backups',
  requirePermissions('operations.backup.create'),
  OperationsController.triggerBackup,
);
operationsRouter.post(
  '/backups/:id/verify',
  requirePermissions('operations.backup.create'),
  OperationsController.verifyBackup,
);
operationsRouter.post(
  '/restore-requests',
  requirePermissions('operations.restore.request'),
  OperationsController.requestRestore,
);
operationsRouter.post(
  '/restore-requests/:id/review',
  requirePermissions('operations.restore.approve'),
  OperationsController.reviewRestore,
);
operationsRouter.get(
  '/maintenance-mode',
  requirePermissions('operations.health.read'),
  OperationsController.getMaintenanceMode,
);
operationsRouter.put(
  '/maintenance-mode',
  requirePermissions('operations.maintenance.manage'),
  OperationsController.setMaintenanceMode,
);
