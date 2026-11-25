import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { sendError } from '../utils/response';
import { verifyAccessToken } from '../utils/token';

let cachedMaintenance: { enabled: boolean; message: string; expiresAt: number } = {
  enabled: false,
  message: 'System is undergoing scheduled maintenance.',
  expiresAt: 0,
};

export function invalidateMaintenanceCache() {
  cachedMaintenance.expiresAt = 0;
}

async function getMaintenanceState() {
  const now = Date.now();
  if (now < cachedMaintenance.expiresAt) {
    return cachedMaintenance;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: { in: ['OPERATIONS_MAINTENANCE_MODE', 'OPERATIONS_MAINTENANCE_MESSAGE'] },
      },
    });
    const map = new Map(configs.map(c => [c.key, c.value]));
    cachedMaintenance = {
      enabled: map.get('OPERATIONS_MAINTENANCE_MODE') === 'true',
      message:
        map.get('OPERATIONS_MAINTENANCE_MESSAGE') ||
        'System is undergoing scheduled maintenance. Please try again shortly.',
      expiresAt: now + 5000,
    };
  } catch {
    // Do not block requests if maintenance config lookup fails
    cachedMaintenance.expiresAt = now + 5000;
  }
  return cachedMaintenance;
}

export const maintenanceMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // Always allow health, auth, and operations endpoints
  if (
    req.path.startsWith('/api/v1/health') ||
    req.path.startsWith('/api/v1/auth') ||
    req.path.startsWith('/api/v1/operations') ||
    req.path === '/'
  ) {
    return next();
  }

  const state = await getMaintenanceState();
  if (!state.enabled) {
    return next();
  }

  // Allow OWNER / ADMIN bypass when a valid Bearer token is present
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(authHeader.split(' ')[1]);
      if (payload.roles.includes('OWNER') || payload.roles.includes('ADMIN')) {
        return next();
      }
    } catch {
      // Fall through to 503
    }
  }

  sendError(res, state.message, { maintenanceMode: true }, 503);
};
