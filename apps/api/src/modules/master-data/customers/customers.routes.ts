import { Router } from 'express';
import { requirePermissions } from '../../../middleware/auth.middleware';
import { CustomersController } from './customers.controller';

export const customersRouter = Router();

customersRouter.get('/', requirePermissions('customers.read'), CustomersController.list);
customersRouter.get('/:id', requirePermissions('customers.read'), CustomersController.getById);
customersRouter.post('/', requirePermissions('customers.create'), CustomersController.create);
customersRouter.patch('/:id', requirePermissions('customers.update'), CustomersController.update);
customersRouter.patch(
  '/:id/status',
  requirePermissions('customers.update'),
  CustomersController.setStatus,
);
