import { Router } from 'express';
import { requirePermissions } from '../../../middleware/auth.middleware';
import { SuppliersController } from './suppliers.controller';

export const suppliersRouter = Router();

suppliersRouter.get('/', requirePermissions('suppliers.read'), SuppliersController.list);
suppliersRouter.get('/:id', requirePermissions('suppliers.read'), SuppliersController.getById);
suppliersRouter.post('/', requirePermissions('suppliers.create'), SuppliersController.create);
suppliersRouter.patch('/:id', requirePermissions('suppliers.update'), SuppliersController.update);
suppliersRouter.patch(
  '/:id/status',
  requirePermissions('suppliers.update'),
  SuppliersController.setStatus,
);
