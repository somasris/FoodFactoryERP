import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { uomRouter, unitConversionsRouter } from './uom/uom.routes';
import { taxRatesRouter, taxConfigsRouter } from './tax/tax.routes';
import {
  rawMaterialCategoriesRouter,
  rawMaterialsRouter,
} from './raw-materials/raw-materials.routes';
import {
  productCategoriesRouter,
  productsRouter,
  productVariantsRouter,
} from './products/products.routes';
import { suppliersRouter } from './suppliers/suppliers.routes';
import { customersRouter } from './customers/customers.routes';
import { warehousesRouter, factoriesRouter } from './warehouses/warehouses.routes';
import { bomsRouter, inventoryItemsRouter } from './boms/boms.routes';

export const masterDataRouter: Router = Router();

// All Master Data routes require valid JWT authentication
masterDataRouter.use(authenticate);

masterDataRouter.use('/uoms', uomRouter);
masterDataRouter.use('/unit-conversions', unitConversionsRouter);
masterDataRouter.use('/tax-rates', taxRatesRouter);
masterDataRouter.use('/tax-configurations', taxConfigsRouter);
masterDataRouter.use('/raw-material-categories', rawMaterialCategoriesRouter);
masterDataRouter.use('/raw-materials', rawMaterialsRouter);
masterDataRouter.use('/product-categories', productCategoriesRouter);
masterDataRouter.use('/products', productsRouter);
masterDataRouter.use('/product-variants', productVariantsRouter);
masterDataRouter.use('/suppliers', suppliersRouter);
masterDataRouter.use('/customers', customersRouter);
masterDataRouter.use('/warehouses', warehousesRouter);
masterDataRouter.use('/factories', factoriesRouter);
masterDataRouter.use('/boms', bomsRouter);
masterDataRouter.use('/inventory-items', inventoryItemsRouter);
