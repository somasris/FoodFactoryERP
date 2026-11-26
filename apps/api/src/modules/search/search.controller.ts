import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { GlobalSearchService } from './search.service';
import { globalSearchQuerySchema } from './search.types';

export class SearchController {
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Authentication required.', 401);
      }
      const parsed = globalSearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError('Invalid search query parameters.', 400, parsed.error.flatten());
      }

      const data = await GlobalSearchService.search(
        {
          userId: req.user.userId,
          username: req.user.username,
          roles: req.user.roles,
          permissions: req.user.permissions,
        },
        parsed.data.q,
        parsed.data.limit,
      );

      return sendSuccess(res, 'Search results retrieved successfully', data);
    } catch (err) {
      return next(err);
    }
  }
}
