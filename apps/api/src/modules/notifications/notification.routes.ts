import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { NotificationController } from './notification.controller';

export const notificationRouter: Router = Router();

// All notification routes require valid JWT authentication and enforce user ownership
notificationRouter.use(authenticate);

notificationRouter.get('/', NotificationController.list);
notificationRouter.get('/unread-count', NotificationController.unreadCount);
notificationRouter.get('/preferences', NotificationController.getPreferences);
notificationRouter.patch('/preferences', NotificationController.updatePreferences);
notificationRouter.get('/stream', NotificationController.stream);
notificationRouter.patch('/read-all', NotificationController.markAllAsRead);
notificationRouter.patch('/archive-all', NotificationController.archiveAll);
notificationRouter.get('/:id', NotificationController.getById);
notificationRouter.patch('/:id/read', NotificationController.markAsRead);
notificationRouter.patch('/:id/archive', NotificationController.archive);
