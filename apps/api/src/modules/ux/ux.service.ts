import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { SyncUserContext } from '../sync/sync.service';
import { redactSensitiveData } from '../governance/governance.service';
import {
  ActivityTimelineQuery,
  CreateSavedViewInput,
  DashboardPreferenceInput,
  MODULE_REQUIRED_PERMISSION,
  SAVED_VIEW_MODULES,
  SavedViewModule,
  UpdateSavedViewInput,
} from './ux.types';

function hasPerm(user: SyncUserContext, perm: string): boolean {
  if (user.roles.includes('OWNER')) return true;
  return user.permissions.includes(perm);
}

function assertModulePermission(user: SyncUserContext, module: SavedViewModule): void {
  const required = MODULE_REQUIRED_PERMISSION[module];
  if (!hasPerm(user, required)) {
    throw new AppError(`Access denied. Missing required permission: ${required}`, 403);
  }
}

type DashboardLayoutMap = Record<
  string,
  { hiddenWidgetIds: string[]; widgetOrder: string[] }
>;

const CATEGORY_ENTITY_TYPES: Record<string, string[]> = {
  SALES: ['SalesOrder', 'SalesInvoice', 'Customer'],
  INVENTORY: [
    'InventoryReceipt',
    'InventoryIssue',
    'InventoryTransfer',
    'InventoryAdjustment',
    'InventoryBatch',
    'StockAudit',
  ],
  PRODUCTION: ['ProductionPlan', 'WorkOrder', 'ProductionBatch', 'BOM'],
  QUALITY: ['QualityInspection', 'ProductionBatchVarianceApproval'],
  ADMINISTRATION: ['User', 'UserRole', 'UserRegistration', 'Role', 'RolePermission', 'SystemConfig', 'Factory'],
  AUTH: ['UserSession'],
};

function resolveSafeEntityLink(
  user: SyncUserContext,
  entityType: string,
  entityId: string,
): string | null {
  if (!entityId || entityId === 'unknown') return null;
  if (entityType === 'SalesOrder' && hasPerm(user, 'sales.orders.read')) {
    return `/sales/orders/${entityId}`;
  }
  if (entityType === 'SalesInvoice' && hasPerm(user, 'sales.invoices.read')) {
    return `/sales/invoices/${entityId}`;
  }
  if (entityType === 'ProductionPlan' && hasPerm(user, 'production.plans.read')) {
    return `/production/plans/${entityId}`;
  }
  if (entityType === 'WorkOrder' && hasPerm(user, 'production.work_orders.read')) {
    return `/production/work-orders/${entityId}`;
  }
  if (entityType === 'ProductionBatch' && hasPerm(user, 'production.batches.read')) {
    return `/production/batches/${entityId}`;
  }
  if (entityType === 'QualityInspection' && hasPerm(user, 'production.quality.read')) {
    return `/production/quality`;
  }
  if (entityType === 'InventoryReceipt' && hasPerm(user, 'inventory.read')) {
    return `/inventory/receipts`;
  }
  if (entityType === 'InventoryTransfer' && hasPerm(user, 'inventory.read')) {
    return `/inventory/transfers`;
  }
  if (entityType === 'User' && hasPerm(user, 'administration.users.read')) {
    return `/admin/users`;
  }
  return null;
}

function classifyEntityCategory(entityType: string, action: string): string {
  if (action === 'LOGIN' || action === 'LOGOUT' || action === 'LOGIN_FAILED') {
    return 'AUTH';
  }
  for (const [cat, types] of Object.entries(CATEGORY_ENTITY_TYPES)) {
    if (types.includes(entityType)) return cat;
  }
  return 'ADMINISTRATION';
}

export class UxService {
  static async getPreferences(userId: string) {
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
    });

    return {
      dashboardLayout: (pref?.dashboardLayout as DashboardLayoutMap | null) ?? {},
      tourCompleted: pref?.tourCompleted ?? false,
      tourCompletedAt: pref?.tourCompletedAt ?? null,
    };
  }

  static async updateDashboardPreference(userId: string, input: DashboardPreferenceInput) {
    const existing = await prisma.userPreference.findUnique({ where: { userId } });
    const currentLayout = (existing?.dashboardLayout as DashboardLayoutMap | null) ?? {};

    const nextLayout: DashboardLayoutMap = {
      ...currentLayout,
      [input.dashboardId]: {
        hiddenWidgetIds: input.hiddenWidgetIds,
        widgetOrder: input.widgetOrder,
      },
    };

    const updated = await prisma.userPreference.upsert({
      where: { userId },
      update: { dashboardLayout: nextLayout as Prisma.InputJsonValue },
      create: {
        userId,
        dashboardLayout: nextLayout as Prisma.InputJsonValue,
      },
    });

    return {
      dashboardLayout: (updated.dashboardLayout as DashboardLayoutMap | null) ?? {},
      tourCompleted: updated.tourCompleted,
      tourCompletedAt: updated.tourCompletedAt,
    };
  }

  static async resetDashboardPreference(userId: string, dashboardId: string) {
    const existing = await prisma.userPreference.findUnique({ where: { userId } });
    if (!existing) {
      return { dashboardLayout: {}, tourCompleted: false, tourCompletedAt: null };
    }

    const currentLayout = (existing.dashboardLayout as DashboardLayoutMap | null) ?? {};
    const nextLayout: DashboardLayoutMap = { ...currentLayout };
    delete nextLayout[dashboardId];

    const updated = await prisma.userPreference.update({
      where: { userId },
      data: { dashboardLayout: nextLayout as Prisma.InputJsonValue },
    });

    return {
      dashboardLayout: (updated.dashboardLayout as DashboardLayoutMap | null) ?? {},
      tourCompleted: updated.tourCompleted,
      tourCompletedAt: updated.tourCompletedAt,
    };
  }

  static async updateTourPreference(userId: string, completed: boolean) {
    const updated = await prisma.userPreference.upsert({
      where: { userId },
      update: {
        tourCompleted: completed,
        tourCompletedAt: completed ? new Date() : null,
      },
      create: {
        userId,
        tourCompleted: completed,
        tourCompletedAt: completed ? new Date() : null,
      },
    });

    return {
      dashboardLayout: (updated.dashboardLayout as DashboardLayoutMap | null) ?? {},
      tourCompleted: updated.tourCompleted,
      tourCompletedAt: updated.tourCompletedAt,
    };
  }

  static async listSavedViews(user: SyncUserContext, module?: string) {
    if (module) {
      if (!SAVED_VIEW_MODULES.includes(module as SavedViewModule)) {
        throw new AppError(`Invalid saved view module: ${module}`, 400);
      }
      assertModulePermission(user, module as SavedViewModule);
    }

    const views = await prisma.savedView.findMany({
      where: {
        userId: user.userId,
        ...(module ? { module } : {}),
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    // Re-filter views by current user permissions so revoked modules are never returned
    return views.filter(v =>
      SAVED_VIEW_MODULES.includes(v.module as SavedViewModule) &&
      hasPerm(user, MODULE_REQUIRED_PERMISSION[v.module as SavedViewModule]),
    );
  }

  static async createSavedView(user: SyncUserContext, input: CreateSavedViewInput) {
    assertModulePermission(user, input.module);

    try {
      return await prisma.$transaction(async tx => {
        if (input.isDefault) {
          await tx.savedView.updateMany({
            where: { userId: user.userId, module: input.module, isDefault: true },
            data: { isDefault: false },
          });
        }

        return await tx.savedView.create({
          data: {
            userId: user.userId,
            module: input.module,
            name: input.name,
            filters: input.filters as Prisma.InputJsonValue,
            sort: input.sort ? (input.sort as Prisma.InputJsonValue) : Prisma.JsonNull,
            columns: input.columns ? (input.columns as Prisma.InputJsonValue) : Prisma.JsonNull,
            isDefault: Boolean(input.isDefault),
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(`A saved view named "${input.name}" already exists for this module.`, 409);
      }
      throw err;
    }
  }

  static async updateSavedView(
    user: SyncUserContext,
    viewId: string,
    input: UpdateSavedViewInput,
  ) {
    const existing = await prisma.savedView.findUnique({ where: { id: viewId } });
    if (!existing) {
      throw new AppError('Saved view not found', 404);
    }
    if (existing.userId !== user.userId) {
      throw new AppError('Access denied. You do not own this saved view.', 403);
    }
    assertModulePermission(user, existing.module as SavedViewModule);

    try {
      return await prisma.$transaction(async tx => {
        if (input.isDefault) {
          await tx.savedView.updateMany({
            where: {
              userId: user.userId,
              module: existing.module,
              isDefault: true,
              id: { not: viewId },
            },
            data: { isDefault: false },
          });
        }

        return await tx.savedView.update({
          where: { id: viewId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.filters !== undefined
              ? { filters: input.filters as Prisma.InputJsonValue }
              : {}),
            ...(input.sort !== undefined
              ? { sort: input.sort ? (input.sort as Prisma.InputJsonValue) : Prisma.JsonNull }
              : {}),
            ...(input.columns !== undefined
              ? { columns: input.columns ? (input.columns as Prisma.InputJsonValue) : Prisma.JsonNull }
              : {}),
            ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(`A saved view named "${input.name}" already exists for this module.`, 409);
      }
      throw err;
    }
  }

  static async deleteSavedView(user: SyncUserContext, viewId: string) {
    const existing = await prisma.savedView.findUnique({ where: { id: viewId } });
    if (!existing) {
      throw new AppError('Saved view not found', 404);
    }
    if (existing.userId !== user.userId) {
      throw new AppError('Access denied. You do not own this saved view.', 403);
    }
    await prisma.savedView.delete({ where: { id: viewId } });
  }

  static async getActivityTimeline(user: SyncUserContext, query: ActivityTimelineQuery) {
    const skip = (query.page - 1) * query.limit;
    const canViewAllGovernance = hasPerm(user, 'governance.audit.read');

    const where: Prisma.AuditLogWhereInput = {};

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(`${query.startDate}T00:00:00.000Z`);
      if (query.endDate) where.createdAt.lte = new Date(`${query.endDate}T23:59:59.999Z`);
    }

    // Enforce user filter permissions
    if (query.userId) {
      if (!canViewAllGovernance && query.userId !== user.userId) {
        throw new AppError('Access denied. You can only filter your own activity.', 403);
      }
      where.userId = query.userId;
    }

    // Build permitted entityTypes based on user permissions
    const permittedEntityTypes: string[] = [];
    if (hasPerm(user, 'sales.orders.read') || hasPerm(user, 'sales.invoices.read')) {
      permittedEntityTypes.push(...CATEGORY_ENTITY_TYPES.SALES);
    }
    if (hasPerm(user, 'inventory.read')) {
      permittedEntityTypes.push(...CATEGORY_ENTITY_TYPES.INVENTORY);
    }
    if (
      hasPerm(user, 'production.plans.read') ||
      hasPerm(user, 'production.work_orders.read') ||
      hasPerm(user, 'production.batches.read')
    ) {
      permittedEntityTypes.push(...CATEGORY_ENTITY_TYPES.PRODUCTION);
    }
    if (hasPerm(user, 'production.quality.read')) {
      permittedEntityTypes.push(...CATEGORY_ENTITY_TYPES.QUALITY);
    }
    if (canViewAllGovernance || hasPerm(user, 'administration.users.read')) {
      permittedEntityTypes.push(...CATEGORY_ENTITY_TYPES.ADMINISTRATION);
    }

    // Category filter
    if (query.category !== 'ALL') {
      if (query.category === 'AUTH') {
        where.action = { in: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'] };
        if (!canViewAllGovernance) {
          where.userId = user.userId;
        }
      } else {
        const catTypes = CATEGORY_ENTITY_TYPES[query.category] ?? [];
        const allowedCatTypes = canViewAllGovernance
          ? catTypes
          : catTypes.filter(t => permittedEntityTypes.includes(t));

        if (allowedCatTypes.length === 0) {
          return {
            items: [],
            pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
          };
        }
        where.entityType = { in: allowedCatTypes };
      }
    } else if (!canViewAllGovernance) {
      where.OR = [
        { userId: user.userId },
        ...(permittedEntityTypes.length > 0 ? [{ entityType: { in: permittedEntityTypes } }] : []),
      ];
    }

    // Exclude internal token family security alerts from non-governance timeline
    if (!canViewAllGovernance) {
      where.entityType = where.entityType ?? { not: 'RefreshTokenFamily' };
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const items = rows.map(row => ({
      id: row.id,
      action: row.action,
      category: classifyEntityCategory(row.entityType, row.action),
      entityType: row.entityType,
      entityId: row.entityId,
      remarks: row.remarks,
      actor: row.user
        ? { id: row.user.id, username: row.user.username, fullName: row.user.fullName }
        : null,
      navigationPath: resolveSafeEntityLink(user, row.entityType, row.entityId),
      metadata: redactSensitiveData(row.newState),
      createdAt: row.createdAt,
    }));

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
