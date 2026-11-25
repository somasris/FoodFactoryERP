import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { loginSchema, refreshSchema, registerSchema } from './auth.types';
import { sendSuccess } from '../../utils/response';
import { env } from '../../config/env';
import { getDemoAccounts, isDemoModeEnabled } from '../../config/demo-accounts';

const REFRESH_COOKIE_NAME = 'ff_refresh_token';

const getCookieOptions = () => {
  const isProduction = env.NODE_ENV === 'production' || env.COOKIE_SECURE === true;
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    maxAge: env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  };
};

const getClearCookieOptions = () => {
  const isProduction = env.NODE_ENV === 'production' || env.COOKIE_SECURE === true;
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    path: '/api/v1/auth',
  };
};

export class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = registerSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const user = await AuthService.register(validatedInput, ipAddress, userAgent);

      sendSuccess(
        res,
        'Account created successfully. You can now sign in.',
        user,
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = loginSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login(validatedInput, ipAddress, userAgent);

      // Set HTTP-only secure cookie for refresh token
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());

      sendSuccess(
        res,
        'Authentication successful',
        {
          user: result.user,
          accessToken: result.accessToken,
          // Also provide refreshToken in body for non-browser mobile/CLI clients
          refreshToken: result.refreshToken,
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = refreshSchema.parse(req.body);
      // Read refresh token from either HTTP-only cookie or request body
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || parsedBody.refreshToken;

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.refresh(rawRefreshToken, ipAddress, userAgent);

      // Set new rotated refresh token in cookie
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());

      sendSuccess(
        res,
        'Session refreshed successfully',
        {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        200,
      );
    } catch (error) {
      // Clear invalid cookie on failure using matching attributes
      res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await AuthService.logout(rawRefreshToken, req.user?.userId, ipAddress, userAgent);

      res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());
      sendSuccess(res, 'Logged out successfully', null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout-all
   */
  static async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthenticated' });
        return;
      }

      await AuthService.logoutAll(req.user.userId, ipAddress, userAgent);

      res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());
      sendSuccess(res, 'All active sessions have been terminated', null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthenticated' });
        return;
      }

      const userProfile = await AuthService.getCurrentUser(req.user.userId);
      sendSuccess(res, 'User profile retrieved successfully', userProfile, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/demo-accounts
   * Returns development/demo account credentials ONLY when demo mode is explicitly enabled
   * in a non-production environment.
   */
  static async demoAccounts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const enabled = isDemoModeEnabled();
      const accounts = enabled
        ? getDemoAccounts().map(a => ({
            role: a.role,
            label: a.label,
            description: a.description,
            email: a.email,
            password: a.password,
          }))
        : [];

      sendSuccess(res, 'Demo account configuration retrieved', { enabled, accounts }, 200);
    } catch (error) {
      next(error);
    }
  }
}
