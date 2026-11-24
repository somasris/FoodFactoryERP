import { Router } from 'express';
import { requirePermissions } from '../../../middleware/auth.middleware';
import { TaxController } from './tax.controller';

export const taxRatesRouter = Router();

taxRatesRouter.get('/', requirePermissions('master_data.read'), TaxController.listTaxRates);
taxRatesRouter.get('/:id', requirePermissions('master_data.read'), TaxController.getTaxRateById);
taxRatesRouter.post('/', requirePermissions('master_data.create'), TaxController.createTaxRate);
taxRatesRouter.patch('/:id', requirePermissions('master_data.update'), TaxController.updateTaxRate);
taxRatesRouter.patch(
  '/:id/status',
  requirePermissions('master_data.update'),
  TaxController.setTaxRateStatus,
);

export const taxConfigsRouter = Router();

taxConfigsRouter.get('/', requirePermissions('master_data.read'), TaxController.listTaxConfigs);
taxConfigsRouter.get('/:id', requirePermissions('master_data.read'), TaxController.getTaxConfigById);
taxConfigsRouter.post('/', requirePermissions('master_data.create'), TaxController.createTaxConfig);
taxConfigsRouter.patch(
  '/:id',
  requirePermissions('master_data.update'),
  TaxController.updateTaxConfig,
);
taxConfigsRouter.patch(
  '/:id/status',
  requirePermissions('master_data.update'),
  TaxController.setTaxConfigStatus,
);
