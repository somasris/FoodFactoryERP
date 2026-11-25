import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { GovernanceController } from './governance.controller';

export const governanceRouter: Router = Router();

governanceRouter.use(authenticate);

// Strictly read-only, append-only audit & governance routes (no PUT/PATCH/DELETE)
governanceRouter.get(
  '/audit-logs',
  requirePermissions('governance.audit.read'),
  GovernanceController.listAuditLogs,
);
governanceRouter.get(
  '/audit-logs/export',
  requirePermissions('governance.audit.export'),
  GovernanceController.exportAuditLogs,
);
governanceRouter.get(
  '/audit-logs/:id',
  requirePermissions('governance.audit.read'),
  GovernanceController.getAuditLogById,
);
governanceRouter.get(
  '/approvals',
  requirePermissions('governance.approvals.read'),
  GovernanceController.getApprovals,
);
governanceRouter.get(
  '/user-activity',
  requirePermissions('governance.activity.read'),
  GovernanceController.getUserActivity,
);
governanceRouter.get(
  '/transactions',
  requirePermissions('governance.audit.read'),
  GovernanceController.getTransactionHistory,
);
