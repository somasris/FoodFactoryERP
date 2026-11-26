import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { BatchQrService } from './batch-qr.service';

export class BatchQrController {
  static async generateOrGet(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required.', 401);
      const data = await BatchQrService.generateOrGetQr(
        String(req.params.batchId),
        {
          userId: req.user.userId,
          username: req.user.username,
          roles: req.user.roles,
          permissions: req.user.permissions,
        },
        { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      );
      return sendSuccess(res, 'Batch QR reference retrieved', data);
    } catch (err) {
      return next(err);
    }
  }

  static async revokeAndRegenerate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required.', 401);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
      const data = await BatchQrService.revokeAndRegenerateQr(
        String(req.params.batchId),
        reason,
        {
          userId: req.user.userId,
          username: req.user.username,
          roles: req.user.roles,
          permissions: req.user.permissions,
        },
        { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      );
      return sendSuccess(res, 'Batch QR reference regenerated', data);
    } catch (err) {
      return next(err);
    }
  }

  static async resolveTraceability(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required.', 401);
      const data = await BatchQrService.resolveQrTraceability(String(req.params.reference), {
        userId: req.user.userId,
        username: req.user.username,
        roles: req.user.roles,
        permissions: req.user.permissions,
      });
      return sendSuccess(res, 'Batch traceability retrieved', data);
    } catch (err) {
      return next(err);
    }
  }
}
