import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { SupplierInvoiceController } from './supplier-invoice.controller';

export const purchasesRouter: Router = Router();

purchasesRouter.use(authenticate);

purchasesRouter.get(
  '/invoices',
  requirePermissions('purchases.invoices.read'),
  SupplierInvoiceController.listInvoices,
);
purchasesRouter.post(
  '/invoices',
  requirePermissions('purchases.invoices.create'),
  SupplierInvoiceController.createDraft,
);
purchasesRouter.get(
  '/invoices/:id',
  requirePermissions('purchases.invoices.read'),
  SupplierInvoiceController.getById,
);
purchasesRouter.patch(
  '/invoices/:id',
  requirePermissions('purchases.invoices.update'),
  SupplierInvoiceController.updateDraft,
);
purchasesRouter.post(
  '/invoices/:id/post',
  requirePermissions('purchases.invoices.post'),
  SupplierInvoiceController.postInvoice,
);
purchasesRouter.post(
  '/invoices/:id/cancel',
  requirePermissions('purchases.invoices.cancel'),
  SupplierInvoiceController.cancelInvoice,
);
purchasesRouter.post(
  '/invoices/:id/match-receipts',
  requirePermissions('purchases.invoices.match'),
  SupplierInvoiceController.matchToReceipts,
);
purchasesRouter.patch(
  '/invoices/:id/itc',
  requirePermissions('purchases.invoices.update'),
  SupplierInvoiceController.updateItcStatus,
);
purchasesRouter.get(
  '/unmatched-receipts',
  requirePermissions('purchases.invoices.read'),
  SupplierInvoiceController.getUnmatchedReceipts,
);
purchasesRouter.get(
  '/register',
  requirePermissions('purchases.invoices.read'),
  SupplierInvoiceController.getPurchaseRegister,
);
