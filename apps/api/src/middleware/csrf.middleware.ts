import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { env } from '../config/env';

/**
 * Anti-CSRF Protection Middleware for state-changing cookie-authenticated endpoints.
 *
 * Requirements enforced:
 * 1. Must supply custom request header `X-Requested-With: XMLHttpRequest`. Standard HTML forms
 *    and cross-site image/script tags cannot generate custom headers.
 * 2. Origin check: If an `Origin` or `Referer` header is present, it must match the explicit
 *    environment-configured FRONTEND_URL allowlist.
 */
export const validateCsrfProtection = (req: Request, _res: Response, next: NextFunction): void => {
  // 1. Verify custom request header
  const requestedWith = req.headers['x-requested-with'];
  if (!requestedWith || requestedWith !== 'XMLHttpRequest') {
    throw new AppError(
      'Forbidden: Missing or invalid required anti-CSRF request header (X-Requested-With: XMLHttpRequest).',
      403,
    );
  }

  // 2. Verify Origin / Referer against allowlist
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;

  const allowedOrigins = [env.FRONTEND_URL];

  if (originHeader) {
    if (!allowedOrigins.includes(originHeader)) {
      throw new AppError(`Forbidden: Cross-origin request blocked by CSRF policy (${originHeader}).`, 403);
    }
  } else if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      const refererOrigin = refererUrl.origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        throw new AppError(`Forbidden: Cross-origin referer blocked by CSRF policy (${refererOrigin}).`, 403);
      }
    } catch {
      throw new AppError('Forbidden: Malformed referer header.', 403);
    }
  }

  next();
};
