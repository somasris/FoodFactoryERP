import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import {
  adminListUsersQuerySchema,
  assignUserWarehouseAccessSchema,
  createFactorySchema,
  createRoleSchema,
  factoryStatusSchema,
  resetUserPasswordSchema,
  updateFactorySchema,
  updateOrganizationSchema,
  updateRolePermissionsSchema,
  updateRoleSchema,
  updateSettingsSchema,
} from './admin.types';
import { AdminActorMeta, OrganizationService } from './organization.service';
import { FactoryService } from './factory.service';
import { RolePermissionService } from './role-permission.service';
import { WarehouseAccessService } from './warehouse-access.service';
import { SystemSettingsService } from './system-settings.service';
import { AdminUserService } from './admin-user.service';

const getActor = (req: Request): AdminActorMeta => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }
  return {
    userId: req.user.userId,
    username: req.user.username,
    roles: req.user.roles || [],
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
};

export class AdminController {
  // ---------------------------------------------------------------------------
  // 4.1.1 Organization Management
  // ---------------------------------------------------------------------------
  static async getOrganization(_req: Request, res: Response, next: NextFunction) {
    try {
      const company = await OrganizationService.getOrganization();
      sendSuccess(res, 'Organization profile retrieved successfully', company);
    } catch (err) {
      next(err);
    }
  }

  static async updateOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateOrganizationSchema.parse(req.body);
      const updated = await OrganizationService.updateOrganization(input, getActor(req));
      sendSuccess(res, 'Organization profile updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  static async getOrganizationHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const history = await OrganizationService.getOrganizationHistory(page, limit);
      sendSuccess(res, 'Organization change history retrieved successfully', history);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // 4.1.2 Factory Management
  // ---------------------------------------------------------------------------
  static async listFactories(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive =
        req.query.isActive === 'true'
          ? true
          : req.query.isActive === 'false'
            ? false
            : undefined;
      const result = await FactoryService.listFactories({
        search: req.query.search ? String(req.query.search) : undefined,
        isActive,
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 20, 100),
      });
      sendSuccess(res, 'Factories retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  static async getFactoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const factory = await FactoryService.getFactoryById(String(req.params.id));
      sendSuccess(res, 'Factory retrieved successfully', factory);
    } catch (err) {
      next(err);
    }
  }

  static async createFactory(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createFactorySchema.parse(req.body);
      const created = await FactoryService.createFactory(input, getActor(req));
      sendSuccess(res, 'Factory created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateFactory(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateFactorySchema.parse(req.body);
      const updated = await FactoryService.updateFactory(
        String(req.params.id),
        input,
        getActor(req),
      );
      sendSuccess(res, 'Factory updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  static async setFactoryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = factoryStatusSchema.parse(req.body);
      const updated = await FactoryService.setFactoryStatus(
        String(req.params.id),
        isActive,
        getActor(req),
      );
      sendSuccess(res, 'Factory status updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // 4.1.3 User Administration Enhancements
  // ---------------------------------------------------------------------------
  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = adminListUsersQuerySchema.parse(req.query);
      const result = await AdminUserService.listUsersPaginated(query);
      sendSuccess(res, 'Users retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  static async resetUserPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const input = resetUserPasswordSchema.parse(req.body);
      const result = await AdminUserService.resetPassword(
        String(req.params.id),
        input,
        getActor(req),
      );
      sendSuccess(res, 'User password reset successfully and active sessions revoked', result);
    } catch (err) {
      next(err);
    }
  }

  static async getUserActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const result = await AdminUserService.getUserActivity(
        String(req.params.id),
        page,
        limit,
      );
      sendSuccess(res, 'User activity history retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // 4.1.4 Role & Permission Administration
  // ---------------------------------------------------------------------------
  static async listRoles(_req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await RolePermissionService.listRoles();
      sendSuccess(res, 'Roles retrieved successfully', roles);
    } catch (err) {
      next(err);
    }
  }

  static async getRoleById(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await RolePermissionService.getRoleById(String(req.params.id));
      sendSuccess(res, 'Role details retrieved successfully', role);
    } catch (err) {
      next(err);
    }
  }

  static async listPermissions(_req: Request, res: Response, next: NextFunction) {
    try {
      const perms = await RolePermissionService.listPermissions();
      sendSuccess(res, 'Permissions retrieved successfully', perms);
    } catch (err) {
      next(err);
    }
  }

  static async createRole(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createRoleSchema.parse(req.body);
      const created = await RolePermissionService.createRole(input, getActor(req));
      sendSuccess(res, 'Custom role created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateRoleSchema.parse(req.body);
      const updated = await RolePermissionService.updateRole(
        String(req.params.id),
        input,
        getActor(req),
      );
      sendSuccess(res, 'Role updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  static async updateRolePermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateRolePermissionsSchema.parse(req.body);
      const updated = await RolePermissionService.updateRolePermissions(
        String(req.params.id),
        input,
        getActor(req),
      );
      sendSuccess(res, 'Role permissions updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  static async getRoleHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const history = await RolePermissionService.getRoleHistory(page, limit);
      sendSuccess(res, 'Role assignment history retrieved successfully', history);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // 4.1.5 Warehouse Access Management
  // ---------------------------------------------------------------------------
  static async listWarehouseAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await WarehouseAccessService.listWarehouseAccess({
        userId: req.query.userId ? String(req.query.userId) : undefined,
        warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
      });
      sendSuccess(res, 'Warehouse access mappings retrieved successfully', items);
    } catch (err) {
      next(err);
    }
  }

  static async assignUserWarehouseAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const input = assignUserWarehouseAccessSchema.parse(req.body);
      const updated = await WarehouseAccessService.assignUserWarehouseAccess(
        String(req.params.userId),
        input,
        getActor(req),
      );
      sendSuccess(res, 'User warehouse access updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  static async revokeWarehouseAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await WarehouseAccessService.revokeWarehouseAccess(
        String(req.params.userId),
        String(req.params.warehouseId),
        getActor(req),
      );
      sendSuccess(res, 'Warehouse access revoked successfully', result);
    } catch (err) {
      next(err);
    }
  }

  static async getWarehouseAccessHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const history = await WarehouseAccessService.getAccessHistory(page, limit);
      sendSuccess(res, 'Warehouse access history retrieved successfully', history);
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // 4.1.6 System Configuration Settings
  // ---------------------------------------------------------------------------
  static async listSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category ? String(req.query.category) : undefined;
      const result = await SystemSettingsService.listSettings(category);
      sendSuccess(res, 'System settings retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateSettingsSchema.parse(req.body);
      const updated = await SystemSettingsService.updateSettings(input, getActor(req));
      sendSuccess(res, 'System settings updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  static async getSettingsHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const history = await SystemSettingsService.getSettingsHistory(page, limit);
      sendSuccess(res, 'System settings change history retrieved successfully', history);
    } catch (err) {
      next(err);
    }
  }
}
