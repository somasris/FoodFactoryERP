import { Router } from 'express';
import { requirePermissions } from '../../../middleware/auth.middleware';
import { RawMaterialsController } from './raw-materials.controller';

export const rawMaterialCategoriesRouter = Router();

rawMaterialCategoriesRouter.get(
  '/',
  requirePermissions('master_data.read'),
  RawMaterialsController.listCategories,
);
rawMaterialCategoriesRouter.get(
  '/:id',
  requirePermissions('master_data.read'),
  RawMaterialsController.getCategoryById,
);
rawMaterialCategoriesRouter.post(
  '/',
  requirePermissions('master_data.create'),
  RawMaterialsController.createCategory,
);
rawMaterialCategoriesRouter.patch(
  '/:id',
  requirePermissions('master_data.update'),
  RawMaterialsController.updateCategory,
);
rawMaterialCategoriesRouter.patch(
  '/:id/status',
  requirePermissions('master_data.update'),
  RawMaterialsController.setCategoryStatus,
);

export const rawMaterialsRouter = Router();

rawMaterialsRouter.get(
  '/',
  requirePermissions('master_data.read'),
  RawMaterialsController.listMaterials,
);
rawMaterialsRouter.get(
  '/:id',
  requirePermissions('master_data.read'),
  RawMaterialsController.getMaterialById,
);
rawMaterialsRouter.post(
  '/',
  requirePermissions('master_data.create'),
  RawMaterialsController.createMaterial,
);
rawMaterialsRouter.patch(
  '/:id',
  requirePermissions('master_data.update'),
  RawMaterialsController.updateMaterial,
);
rawMaterialsRouter.patch(
  '/:id/status',
  requirePermissions('master_data.update'),
  RawMaterialsController.setMaterialStatus,
);
