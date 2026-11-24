import { Router } from 'express';
import { requirePermissions } from '../../../middleware/auth.middleware';
import { UomController } from './uom.controller';

export const uomRouter = Router();

uomRouter.get('/', requirePermissions('master_data.read'), UomController.listUoms);
uomRouter.get('/:id', requirePermissions('master_data.read'), UomController.getUomById);
uomRouter.post('/', requirePermissions('master_data.create'), UomController.createUom);
uomRouter.patch('/:id', requirePermissions('master_data.update'), UomController.updateUom);
uomRouter.patch('/:id/status', requirePermissions('master_data.update'), UomController.setUomStatus);

export const unitConversionsRouter = Router();

unitConversionsRouter.get('/', requirePermissions('master_data.read'), UomController.listConversions);
unitConversionsRouter.get(
  '/:id',
  requirePermissions('master_data.read'),
  UomController.getConversionById,
);
unitConversionsRouter.post(
  '/',
  requirePermissions('master_data.create'),
  UomController.createConversion,
);
unitConversionsRouter.post(
  '/calculate',
  requirePermissions('master_data.read'),
  UomController.convertQuantity,
);
unitConversionsRouter.patch(
  '/:id',
  requirePermissions('master_data.update'),
  UomController.updateConversion,
);
unitConversionsRouter.patch(
  '/:id/status',
  requirePermissions('master_data.update'),
  UomController.setConversionStatus,
);
