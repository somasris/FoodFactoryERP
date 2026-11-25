import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { NotificationService } from './notification.service';
import { NotificationSseService } from './notification-sse.service';
import {
  listNotificationsQuerySchema,
  updatePreferencesSchema,
} from './notification.types';

export class NotificationController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listNotificationsQuerySchema.parse(req.query);
      const data = await NotificationService.listForUser(req.user!.userId, query);
      sendSuccess(res, 'Notifications retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async unreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const unreadCount = await NotificationService.getUnreadCount(req.user!.userId);
      sendSuccess(res, 'Unread notification count retrieved', { unreadCount });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await NotificationService.getById(req.user!.userId, String(req.params.id));
      sendSuccess(res, 'Notification details retrieved', data);
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await NotificationService.markAsRead(req.user!.userId, String(req.params.id));
      sendSuccess(res, 'Notification marked as read', data);
    } catch (error) {
      next(error);
    }
  }

  static async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await NotificationService.markAllAsRead(req.user!.userId);
      sendSuccess(res, 'All notifications marked as read', data);
    } catch (error) {
      next(error);
    }
  }

  static async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await NotificationService.archive(req.user!.userId, String(req.params.id));
      sendSuccess(res, 'Notification archived', data);
    } catch (error) {
      next(error);
    }
  }

  static async archiveAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await NotificationService.archiveAll(req.user!.userId);
      sendSuccess(res, 'All notifications archived', data);
    } catch (error) {
      next(error);
    }
  }

  static async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await NotificationService.getPreferences(req.user!.userId);
      sendSuccess(res, 'Notification preferences retrieved', data);
    } catch (error) {
      next(error);
    }
  }

  static async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updatePreferencesSchema.parse(req.body);
      const data = await NotificationService.updatePreferences(req.user!.userId, body);
      sendSuccess(res, 'Notification preferences updated', data);
    } catch (error) {
      next(error);
    }
  }

  static async stream(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const clientId = NotificationSseService.addClient(userId, res);

      req.on('close', () => {
        NotificationSseService.removeClient(userId, clientId);
      });

      // Deliver any pending outbox events accumulated while offline
      await NotificationService.deliverPendingOutboxForUser(userId);
    } catch (error) {
      next(error);
    }
  }
}
