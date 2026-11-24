import { Router } from 'express';
import { requirePermissions } from '../../../middleware/auth.middleware';
import { ProductsController } from './products.controller';

export const productCategoriesRouter = Router();

productCategoriesRouter.get(
  '/',
  requirePermissions('master_data.read'),
  ProductsController.listCategories,
);
productCategoriesRouter.get(
  '/:id',
  requirePermissions('master_data.read'),
  ProductsController.getCategoryById,
);
productCategoriesRouter.post(
  '/',
  requirePermissions('master_data.create'),
  ProductsController.createCategory,
);
productCategoriesRouter.patch(
  '/:id',
  requirePermissions('master_data.update'),
  ProductsController.updateCategory,
);
productCategoriesRouter.patch(
  '/:id/status',
  requirePermissions('master_data.update'),
  ProductsController.setCategoryStatus,
);

export const productsRouter = Router();

productsRouter.get('/', requirePermissions('master_data.read'), ProductsController.listProducts);
productsRouter.get('/:id', requirePermissions('master_data.read'), ProductsController.getProductById);
productsRouter.post('/', requirePermissions('master_data.create'), ProductsController.createProduct);
productsRouter.patch(
  '/:id',
  requirePermissions('master_data.update'),
  ProductsController.updateProduct,
);
productsRouter.patch(
  '/:id/status',
  requirePermissions('master_data.update'),
  ProductsController.setProductStatus,
);

export const productVariantsRouter = Router();

productVariantsRouter.get(
  '/',
  requirePermissions('master_data.read'),
  ProductsController.listVariants,
);
productVariantsRouter.get(
  '/:id',
  requirePermissions('master_data.read'),
  ProductsController.getVariantById,
);
productVariantsRouter.post(
  '/',
  requirePermissions('master_data.create'),
  ProductsController.createVariant,
);
productVariantsRouter.patch(
  '/:id',
  requirePermissions('master_data.update'),
  ProductsController.updateVariant,
);
productVariantsRouter.patch(
  '/:id/status',
  requirePermissions('master_data.update'),
  ProductsController.setVariantStatus,
);
