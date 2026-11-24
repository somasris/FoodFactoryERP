import { Router } from 'express';
import { requirePermissions, requireWarehouseAccess } from '../../../middleware/auth.middleware';
import { WarehousesController } from './warehouses.controller';

export const warehousesRouter = Router();

warehousesRouter.get('/', requirePermissions('warehouses.read'), WarehousesController.list);
warehousesRouter.get(
  '/:id',
  requirePermissions('warehouses.read'),
  requireWarehouseAccess('id', 'READ'),
  WarehousesController.getById,
);
warehousesRouter.post('/', requirePermissions('warehouses.create'), WarehousesController.create);
warehousesRouter.patch(
  '/:id',
  requirePermissions('warehouses.update'),
  WarehousesController.update,
);
warehousesRouter.patch(
  '/:id/status',
  requirePermissions('warehouses.update'),
  WarehousesController.setStatus,
);

export const factoriesRouter = Router();
factoriesRouter.get('/', requirePermissions('warehouses.read'), WarehousesController.listFactories);
