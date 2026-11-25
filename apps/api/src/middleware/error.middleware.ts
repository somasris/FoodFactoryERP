import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';
import { TelemetryStore } from '../utils/telemetry';

export class AppError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error(`Error processing ${req.method} ${req.originalUrl}: ${err.message}`);

  const requestId = req.requestId || 'unknown';
  const envName = process.env.NODE_ENV || 'development';

  if (err instanceof AppError) {
    TelemetryStore.recordError({
      requestId,
      category: err.statusCode === 401 || err.statusCode === 403 ? 'AUTH' : 'BUSINESS',
      message: err.message,
      route: req.originalUrl.split('?')[0],
      method: req.method,
      statusCode: err.statusCode,
      environment: envName,
      timestamp: new Date().toISOString(),
    });
    sendError(res, err.message, err.details, err.statusCode);
    return;
  }

  if (err instanceof ZodError) {
    TelemetryStore.recordError({
      requestId,
      category: 'VALIDATION',
      message: 'Request validation failed',
      route: req.originalUrl.split('?')[0],
      method: req.method,
      statusCode: 400,
      environment: envName,
      timestamp: new Date().toISOString(),
    });
    sendError(res, 'Request validation failed', err.format(), 400);
    return;
  }

  TelemetryStore.recordError({
    requestId,
    category: 'SYSTEM',
    message: err.message,
    route: req.originalUrl.split('?')[0],
    method: req.method,
    statusCode: 500,
    environment: envName,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  const isProduction = envName === 'production';
  sendError(
    res,
    'Internal server error',
    isProduction ? { requestId } : { requestId, message: err.message, stack: err.stack },
    500,
  );
};
