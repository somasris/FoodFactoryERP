import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import {
  assignRolesSchema,
  createUserSchema,
  updateStatusSchema,
  updateUserSchema,
} from './users.types';
import { sendSuccess } from '../../utils/response';

export class UsersController {
  /**
   * GET /api/v1/users
   */
  static async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await UsersService.listUsers();
      sendSuccess(res, 'Users retrieved successfully', users);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UsersService.getUserById(String(req.params.id));
      sendSuccess(res, 'User retrieved successfully', user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/users
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createUserSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const user = await UsersService.createUser(validated, req.user?.userId, ipAddress, userAgent);
      sendSuccess(res, 'User created successfully', user, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/users/:id
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateUserSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const user = await UsersService.updateUser(
        String(req.params.id),
        validated,
        req.user?.userId,
        ipAddress,
        userAgent,
      );
      sendSuccess(res, 'User updated successfully', user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/users/:id/roles
   */
  static async assignRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = assignRolesSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await UsersService.assignRoles(
        String(req.params.id),
        validated,
        req.user?.userId,
        ipAddress,
        userAgent,
      );
      sendSuccess(res, 'User roles assigned successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/users/:id/status
   */
  static async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateStatusSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const user = await UsersService.setUserStatus(
        String(req.params.id),
        validated,
        req.user?.userId,
        ipAddress,
        userAgent,
      );
      sendSuccess(res, 'User status updated successfully', user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/users/:id/revoke-sessions
   */
  static async revokeSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await UsersService.revokeUserSessions(
        String(req.params.id),
        req.user?.userId,
        ipAddress,
        userAgent,
      );
      sendSuccess(res, 'User sessions revoked successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
