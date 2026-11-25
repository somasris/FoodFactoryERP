import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { SalesController } from './sales.controller';

export const salesRouter: Router = Router();

// All Sales routes require valid JWT authentication
salesRouter.use(authenticate);

salesRouter.get(
  '/dashboard',
  requirePermissions('sales.dashboard.read'),
  SalesController.dashboard,
);
salesRouter.get('/orders', requirePermissions('sales.orders.read'), SalesController.listOrders);
salesRouter.get(
  '/customers/:customerId/orders',
  requirePermissions('sales.orders.read'),
  SalesController.listCustomerOrders,
);
salesRouter.get('/orders/:id', requirePermissions('sales.orders.read'), SalesController.getOrderById);
salesRouter.get(
  '/orders/:id/history',
  requirePermissions('sales.orders.read'),
  SalesController.getOrderHistory,
);
salesRouter.post('/orders', requirePermissions('sales.orders.create'), SalesController.createOrder);
salesRouter.patch(
  '/orders/:id',
  requirePermissions('sales.orders.update'),
  SalesController.updateOrder,
);
salesRouter.post(
  '/orders/:id/submit',
  requirePermissions('sales.orders.submit'),
  SalesController.submitOrder,
);
salesRouter.post(
  '/orders/:id/approve',
  requirePermissions('sales.orders.approve'),
  SalesController.approveOrder,
);
salesRouter.post(
  '/orders/:id/reject',
  requirePermissions('sales.orders.reject'),
  SalesController.rejectOrder,
);
salesRouter.post(
  '/orders/:id/confirm',
  requirePermissions('sales.orders.confirm'),
  SalesController.confirmOrder,
);
salesRouter.post(
  '/orders/:id/cancel',
  requirePermissions('sales.orders.cancel'),
  SalesController.cancelOrder,
);
salesRouter.post(
  '/orders/:id/fulfill',
  requirePermissions('sales.orders.fulfill'),
  SalesController.fulfillOrder,
);
