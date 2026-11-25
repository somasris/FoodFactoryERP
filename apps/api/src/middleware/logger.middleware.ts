import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { TelemetryStore } from '../utils/telemetry';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const { method, originalUrl } = req;
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    logger.info(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);
    TelemetryStore.recordRequest({
      requestId,
      method,
      route: originalUrl.split('?')[0],
      statusCode,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  });

  next();
};
