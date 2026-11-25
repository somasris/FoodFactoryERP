import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { AdminController } from './admin.controller';

export const adminRouter: Router = Router();

adminRouter.use(authenticate);

// 4.1.1 Organization Management
adminRouter.get(
  '/organization',
  requirePermissions('administration.organization.read'),
  AdminController.getOrganization,
);
adminRouter.patch(
  '/organization',
  requirePermissions('administration.organization.update'),
  AdminController.updateOrganization,
);
adminRouter.get(
  '/organization/history',
  requirePermissions('administration.organization.read'),
  AdminController.getOrganizationHistory,
);

// 4.1.2 Factory Management
adminRouter.get(
  '/factories',
  requirePermissions('administration.factories.read'),
  AdminController.listFactories,
);
adminRouter.get(
  '/factories/:id',
  requirePermissions('administration.factories.read'),
  AdminController.getFactoryById,
);
adminRouter.post(
  '/factories',
  requirePermissions('administration.factories.manage'),
  AdminController.createFactory,
);
adminRouter.patch(
  '/factories/:id',
  requirePermissions('administration.factories.manage'),
  AdminController.updateFactory,
);
adminRouter.patch(
  '/factories/:id/status',
  requirePermissions('administration.factories.manage'),
  AdminController.setFactoryStatus,
);

// 4.1.3 User Administration Enhancements
adminRouter.get(
  '/users',
  requirePermissions('administration.users.read'),
  AdminController.listUsers,
);
adminRouter.post(
  '/users/:id/reset-password',
  requirePermissions('administration.users.manage'),
  AdminController.resetUserPassword,
);
adminRouter.post(
  '/users/:id/review-registration',
  requirePermissions('administration.users.manage'),
  AdminController.reviewRegistration,
);
adminRouter.get(
  '/users/:id/activity',
  requirePermissions('administration.users.read'),
  AdminController.getUserActivity,
);

// 4.1.4 Role & Permission Administration
adminRouter.get(
  '/roles',
  requirePermissions('administration.roles.read'),
  AdminController.listRoles,
);
adminRouter.get(
  '/roles/history',
  requirePermissions('administration.roles.read'),
  AdminController.getRoleHistory,
);
adminRouter.get(
  '/roles/:id',
  requirePermissions('administration.roles.read'),
  AdminController.getRoleById,
);
adminRouter.post(
  '/roles',
  requirePermissions('administration.roles.manage'),
  AdminController.createRole,
);
adminRouter.patch(
  '/roles/:id',
  requirePermissions('administration.roles.manage'),
  AdminController.updateRole,
);
adminRouter.put(
  '/roles/:id/permissions',
  requirePermissions('administration.roles.manage'),
  AdminController.updateRolePermissions,
);
adminRouter.get(
  '/permissions',
  requirePermissions('administration.roles.read'),
  AdminController.listPermissions,
);

// 4.1.5 Warehouse Access Management
adminRouter.get(
  '/warehouse-access',
  requirePermissions('administration.warehouse_access.read'),
  AdminController.listWarehouseAccess,
);
adminRouter.get(
  '/warehouse-access/history',
  requirePermissions('administration.warehouse_access.read'),
  AdminController.getWarehouseAccessHistory,
);
adminRouter.put(
  '/warehouse-access/users/:userId',
  requirePermissions('administration.warehouse_access.manage'),
  AdminController.assignUserWarehouseAccess,
);
adminRouter.delete(
  '/warehouse-access/users/:userId/warehouses/:warehouseId',
  requirePermissions('administration.warehouse_access.manage'),
  AdminController.revokeWarehouseAccess,
);

// 4.1.6 System Configuration Settings
adminRouter.get(
  '/settings',
  requirePermissions('administration.settings.read'),
  AdminController.listSettings,
);
adminRouter.put(
  '/settings',
  requirePermissions('administration.settings.update'),
  AdminController.updateSettings,
);
adminRouter.get(
  '/settings/history',
  requirePermissions('administration.settings.read'),
  AdminController.getSettingsHistory,
);
