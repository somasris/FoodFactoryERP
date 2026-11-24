import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma.service';
import { env } from '../config/env';
import { sendSuccess, sendError } from '../utils/response';

export const healthRouter: Router = Router();

/**
 * GET /api/v1/health
 * Returns application name, API status, environment and current server timestamp.
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  return sendSuccess(res, 'FoodFactory ERP API is operating normally', {
    application: 'FoodFactory ERP API',
    status: 'healthy',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/health/database
 * Verifies live PostgreSQL connectivity using Prisma client.
 */
healthRouter.get('/database', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    // Perform raw SQL ping to ensure database connection and query readiness
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    return sendSuccess(res, 'PostgreSQL database connection verified successfully', {
      application: 'FoodFactory ERP API',
      database: 'PostgreSQL',
      status: 'connected',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return sendError(
      res,
      'PostgreSQL database connection check failed',
      {
        status: 'disconnected',
        latencyMs,
        details: error instanceof Error ? error.message : 'Unknown database error',
      },
      503,
    );
  }
});
