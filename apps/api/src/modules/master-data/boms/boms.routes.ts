import { Router } from 'express';
import { requirePermissions } from '../../../middleware/auth.middleware';
import { BomsController } from './boms.controller';

export const bomsRouter = Router();

bomsRouter.get('/', requirePermissions('bom.read'), BomsController.list);
bomsRouter.get('/:id', requirePermissions('bom.read'), BomsController.getById);
bomsRouter.post('/', requirePermissions('bom.create'), BomsController.create);
bomsRouter.patch('/:id', requirePermissions('bom.update'), BomsController.updateHeader);
bomsRouter.patch('/:id/status', requirePermissions('bom.update'), BomsController.setStatus);
bomsRouter.post('/:id/versions', requirePermissions('bom.create'), BomsController.createVersion);
bomsRouter.patch(
  '/:id/versions/:versionId',
  requirePermissions('bom.update'),
  BomsController.updateVersion,
);
bomsRouter.post(
  '/:id/versions/:versionId/activate',
  requirePermissions('bom.approve'),
  BomsController.activateVersion,
);
bomsRouter.post(
  '/:id/versions/:versionId/obsolete',
  requirePermissions('bom.approve'),
  BomsController.obsoleteVersion,
);
bomsRouter.get(
  '/:id/versions/:versionId/cost-estimate',
  requirePermissions('bom.read'),
  BomsController.getVersionCostEstimate,
);
bomsRouter.get('/:id/history', requirePermissions('bom.read'), BomsController.getHistory);

export const inventoryItemsRouter = Router();
inventoryItemsRouter.get(
  '/',
  requirePermissions('master_data.read'),
  BomsController.listInventoryItems,
);
