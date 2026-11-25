import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { ComplianceController } from './compliance.controller';

export const complianceRouter: Router = Router();

complianceRouter.use(authenticate);

// 4.2.1 & 4.2.2 GST & Tax Summaries
complianceRouter.get(
  '/gst/sales-summary',
  requirePermissions('compliance.tax.read'),
  ComplianceController.getGstSalesSummary,
);
complianceRouter.get(
  '/gst/purchase-summary',
  requirePermissions('compliance.tax.read'),
  ComplianceController.getPurchaseTaxSummary,
);

// 4.2.3 Inventory Valuation & Stock Audit
complianceRouter.get(
  '/inventory/valuation',
  requirePermissions('compliance.inventory.read'),
  ComplianceController.getInventoryValuation,
);
complianceRouter.get(
  '/stock-audits',
  requirePermissions('compliance.stock_audit.read'),
  ComplianceController.listStockAudits,
);
complianceRouter.get(
  '/stock-audits/:id',
  requirePermissions('compliance.stock_audit.read'),
  ComplianceController.getStockAuditById,
);
complianceRouter.post(
  '/stock-audits',
  requirePermissions('compliance.stock_audit.create'),
  ComplianceController.createStockAudit,
);
complianceRouter.post(
  '/stock-audits/:id/submit',
  requirePermissions('compliance.stock_audit.create'),
  ComplianceController.submitStockAudit,
);
complianceRouter.post(
  '/stock-audits/:id/review',
  requirePermissions('compliance.stock_audit.review'),
  ComplianceController.reviewStockAudit,
);
complianceRouter.post(
  '/stock-audits/:id/post',
  requirePermissions('compliance.stock_audit.review'),
  ComplianceController.postStockAudit,
);

// 4.2.4 Production Cost Compliance
complianceRouter.get(
  '/production-costing',
  requirePermissions('production.costing.read', 'compliance.inventory.read'),
  ComplianceController.getProductionCostCompliance,
);

// 4.2.5 Traceability & Exports
complianceRouter.get(
  '/traceability',
  requirePermissions('compliance.inventory.read'),
  ComplianceController.getTraceabilityReport,
);
complianceRouter.get(
  '/export/:reportType',
  requirePermissions('compliance.export'),
  ComplianceController.exportReport,
);

// 4.2.6 Compliance Documents
complianceRouter.get(
  '/documents',
  requirePermissions('compliance.documents.read'),
  ComplianceController.listDocuments,
);
complianceRouter.post(
  '/documents',
  requirePermissions('compliance.documents.manage'),
  ComplianceController.createDocument,
);
complianceRouter.post(
  '/documents/:id/verify',
  requirePermissions('compliance.documents.manage'),
  ComplianceController.verifyDocument,
);
