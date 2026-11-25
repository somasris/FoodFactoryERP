import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/token';
import { AppError } from './error.middleware';
import { prisma } from '../services/prisma.service';

// Augment Express Request to hold the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Explicit set of permitted read-only permissions.
 * AUDITOR role is strictly prohibited from executing any permission outside this explicit set.
 */
export const READ_ONLY_PERMISSIONS = new Set([
  'users.read',
  'customers.read',
  'master_data.read',
  'suppliers.read',
  'warehouses.read',
  'bom.read',
  'sales.orders.read',
  'sales.dashboard.read',
  'sales.invoices.read',
  'sales.invoices.download',
  'inventory.read',
  'inventory.valuation.read',
  'production.read',
  'production.plans.read',
  'production.demand.read',
  'production.work_orders.read',
  'production.batches.read',
  'production.quality.read',
  'production.costing.read',
  'production.reports.read',
  'production.reports.costing.read',
  'production.reports.export',
  'purchases.read',
  'invoices.read',
  'payments.read',
  'reports.read',
  'audit.read',
  // Phase 4.1 System Administration (Read-Only)
  'administration.organization.read',
  'administration.factories.read',
  'administration.users.read',
  'administration.roles.read',
  'administration.warehouse_access.read',
  'administration.settings.read',
]);

/**
 * Authentication Middleware:
 * Validates JWT Bearer token in the Authorization header.
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required. Missing or malformed Bearer token.', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired. Please refresh your session.', 401, {
        code: 'TOKEN_EXPIRED',
      });
    }
    throw new AppError('Invalid or corrupted access token.', 401);
  }
};

/**
 * Role-Based Access Control Middleware:
 * Requires user to have at least one of the allowed roles.
 * Note: OWNER role possesses global operational authorization.
 */
export const requireRoles = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Unauthenticated request', 401);
    }

    const userRoles = req.user.roles || [];
    const isOwner = userRoles.includes('OWNER');

    const hasAllowedRole = isOwner || allowedRoles.some(role => userRoles.includes(role));

    if (!hasAllowedRole) {
      throw new AppError(
        `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`,
        403,
      );
    }

    next();
  };
};

/**
 * Permission-Based Access Control Middleware:
 * Requires user to have all specified permissions.
 * AUDITOR role is strictly enforced read-only via explicit permission set.
 * OWNER role possesses universal permissions.
 */
export const requirePermissions = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Unauthenticated request', 401);
    }

    const userRoles = req.user.roles || [];
    const userPermissions = new Set(req.user.permissions || []);

    // OWNER has master permissions across all business domains
    if (userRoles.includes('OWNER')) {
      return next();
    }

    // AUDITOR role is strictly read-only: deny any mutation permission by explicit classification
    if (userRoles.includes('AUDITOR')) {
      const hasMutationPermission = requiredPermissions.some(
        perm => !READ_ONLY_PERMISSIONS.has(perm),
      );
      if (hasMutationPermission) {
        throw new AppError(
          'Access denied. AUDITOR role is restricted to read-only operations.',
          403,
        );
      }
    }

    // Check if user holds all required permissions
    const missingPermissions = requiredPermissions.filter(perm => !userPermissions.has(perm));

    if (missingPermissions.length > 0) {
      throw new AppError(
        `Forbidden: Missing required permission(s): [${missingPermissions.join(', ')}]`,
        403,
      );
    }

    next();
  };
};

/**
 * Physical Facility Scoping Middleware:
 * Restricts operations to warehouses the user is specifically assigned to.
 * ADMIN and OWNER have enterprise-wide facility access per approved business policy.
 */
export const requireWarehouseAccess = (
  paramName = 'warehouseId',
  requiredLevel: 'READ' | 'READ_WRITE' = 'READ',
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Unauthenticated request', 401);
      }

      const warehouseId = (req.params[paramName] || req.body[paramName] || req.query[paramName]) as string;

      if (!warehouseId) {
        throw new AppError(`Missing required warehouse identifier '${paramName}'.`, 400);
      }

      const userRoles = req.user.roles || [];

      // Global roles bypass single-warehouse restrictions
      if (userRoles.includes('OWNER') || userRoles.includes('ADMIN')) {
        return next();
      }

      // Check physical assignment
      const access = await prisma.userWarehouseAccess.findUnique({
        where: {
          userId_warehouseId: {
            userId: req.user.userId,
            warehouseId,
          },
        },
      });

      if (!access) {
        throw new AppError('Access denied: You are not authorized for this warehouse facility.', 403);
      }

      if (requiredLevel === 'READ_WRITE' && access.accessLevel === 'READ') {
        throw new AppError(
          'Access denied: You have read-only access to this warehouse facility.',
          403,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
