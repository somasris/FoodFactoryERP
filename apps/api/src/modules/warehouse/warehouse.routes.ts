import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { WarehouseController } from './warehouse.controller';

export const warehouseRouter: Router = Router();

warehouseRouter.use(authenticate);

// Hierarchy: Layout, Zones, Racks, Shelves, Bins
warehouseRouter.get(
  '/layout/:warehouseId',
  requirePermissions('inventory.read'),
  WarehouseController.getLayout,
);
warehouseRouter.get('/zones', requirePermissions('inventory.read'), WarehouseController.listZones);
warehouseRouter.post('/zones', requirePermissions('warehouses.update'), WarehouseController.createZone);
warehouseRouter.patch(
  '/zones/:id',
  requirePermissions('warehouses.update'),
  WarehouseController.updateZone,
);
warehouseRouter.post('/racks', requirePermissions('warehouses.update'), WarehouseController.createRack);
warehouseRouter.post(
  '/shelves',
  requirePermissions('warehouses.update'),
  WarehouseController.createShelf,
);
warehouseRouter.get('/bins', requirePermissions('inventory.read'), WarehouseController.listBins);
warehouseRouter.post('/bins', requirePermissions('warehouses.update'), WarehouseController.createBin);
warehouseRouter.patch(
  '/bins/:id',
  requirePermissions('warehouses.update'),
  WarehouseController.updateBin,
);

// Location Stock & Bin Movements
warehouseRouter.get(
  '/location-stock',
  requirePermissions('inventory.read'),
  WarehouseController.listLocationStock,
);
warehouseRouter.get(
  '/movements',
  requirePermissions('inventory.read'),
  WarehouseController.listLocationMovements,
);
warehouseRouter.post(
  '/put-away',
  requirePermissions('inventory.transfer.create'),
  WarehouseController.putAway,
);
warehouseRouter.post(
  '/bin-transfers',
  requirePermissions('inventory.transfer.create'),
  WarehouseController.binTransfer,
);
warehouseRouter.post(
  '/pick',
  requirePermissions('inventory.issue.create'),
  WarehouseController.pickFromBin,
);

// Barcodes & Scan Workflows
warehouseRouter.get('/barcodes', requirePermissions('inventory.read'), WarehouseController.listBarcodes);
warehouseRouter.post(
  '/barcodes',
  requirePermissions('inventory.receipt.create'),
  WarehouseController.createBarcode,
);
warehouseRouter.get(
  '/barcodes/lookup',
  requirePermissions('inventory.read'),
  WarehouseController.lookupBarcode,
);
warehouseRouter.post(
  '/scan/execute',
  requirePermissions('inventory.transfer.create'),
  WarehouseController.executeScan,
);

// Picking & Put-away Suggestions (Read-only advisory)
warehouseRouter.get(
  '/suggestions/picking',
  requirePermissions('inventory.read'),
  WarehouseController.suggestPicking,
);
warehouseRouter.get(
  '/suggestions/put-away',
  requirePermissions('inventory.read'),
  WarehouseController.suggestPutAway,
);

// Cycle Counting (extending StockAudit) & Analytics
warehouseRouter.get(
  '/cycle-counts/plans',
  requirePermissions('compliance.stock_audit.read'),
  WarehouseController.listCycleCountPlans,
);
warehouseRouter.post(
  '/cycle-counts/plans',
  requirePermissions('compliance.stock_audit.create'),
  WarehouseController.createCycleCountPlan,
);
warehouseRouter.patch(
  '/cycle-counts/plans/:id/status',
  requirePermissions('compliance.stock_audit.create'),
  WarehouseController.updateCycleCountPlanStatus,
);
warehouseRouter.post(
  '/cycle-counts/plans/:planId/generate',
  requirePermissions('compliance.stock_audit.create'),
  WarehouseController.generateCycleCountAudit,
);
warehouseRouter.post(
  '/cycle-counts/audits/:auditId/count',
  requirePermissions('compliance.stock_audit.create'),
  WarehouseController.recordCycleCount,
);
warehouseRouter.post(
  '/cycle-counts/audits/:auditId/investigate',
  requirePermissions('compliance.stock_audit.create'),
  WarehouseController.investigateVariance,
);
warehouseRouter.get(
  '/analytics/:warehouseId',
  requirePermissions('inventory.read'),
  WarehouseController.getAnalytics,
);
