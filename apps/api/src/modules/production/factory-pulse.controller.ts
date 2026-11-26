import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { FactoryPulseService } from './factory-pulse.service';

export class FactoryPulseController {
  static async getPulse(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required.', 401);
      }
      const data = await FactoryPulseService.getPulse(
        {
          userId: req.user.userId,
          roles: req.user.roles,
        },
        {
          factoryId: typeof req.query.factoryId === 'string' ? req.query.factoryId : undefined,
          warehouseId: typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined,
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
        },
      );
      return sendSuccess(res, 'Factory pulse retrieved successfully', data);
    } catch (err) {
      return next(err);
    }
  }
}
