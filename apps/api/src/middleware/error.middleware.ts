import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

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

  if (err instanceof AppError) {
    sendError(res, err.message, err.details, err.statusCode);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, 'Request validation failed', err.format(), 400);
    return;
  }

  // Generic internal server error
  const isProduction = process.env.NODE_ENV === 'production';
  sendError(
    res,
    'Internal server error',
    isProduction ? undefined : { message: err.message, stack: err.stack },
    500,
  );
};
