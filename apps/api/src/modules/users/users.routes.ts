import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';

export const usersRouter = Router();

// All user management routes require valid authentication
usersRouter.use(authenticate);

usersRouter.get('/', requirePermissions('users.read'), UsersController.list);
usersRouter.get('/:id', requirePermissions('users.read'), UsersController.getById);
usersRouter.post('/', requirePermissions('users.create'), UsersController.create);
usersRouter.patch('/:id', requirePermissions('users.update'), UsersController.update);
usersRouter.put(
  '/:id/roles',
  requirePermissions('users.roles.assign'),
  UsersController.assignRoles,
);
usersRouter.patch('/:id/status', requirePermissions('users.disable'), UsersController.setStatus);
usersRouter.post(
  '/:id/revoke-sessions',
  requirePermissions('users.sessions.revoke'),
  UsersController.revokeSessions,
);
