import { Request, Response, NextFunction } from 'express';
import { BarcodeEntityType, CycleCountPlanStatus, StorageCondition } from '@prisma/client';
import { sendSuccess } from '../../utils/response';
import { AuditMeta } from '../master-data/master-data.utils';
import { UserContext } from '../inventory/inventory.utils';
import { WarehouseLocationService } from './warehouse-location.service';
import { WarehouseBarcodeService } from './warehouse-barcode.service';
import { WarehouseSuggestionService } from './warehouse-suggestion.service';
import { WarehouseCycleCountService } from './warehouse-cycle-count.service';
import {
  binTransferSchema,
  createBarcodeSchema,
  createBinSchema,
  createCycleCountPlanSchema,
  createRackSchema,
  createShelfSchema,
  createZoneSchema,
  investigateVarianceSchema,
  pickFromBinSchema,
  putAwaySchema,
  recordCycleCountSchema,
  scanExecuteSchema,
  updateBinSchema,
  updateCycleCountPlanStatusSchema,
  updateZoneSchema,
} from './warehouse.types';

const getUserCtx = (req: Request): UserContext => ({
  userId: req.user!.userId,
  roles: req.user!.roles || [],
});

const getAuditMeta = (req: Request): AuditMeta => ({
  userId: req.user?.userId,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

export class WarehouseController {
  // Hierarchy
  static async getLayout(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseLocationService.getWarehouseLayout(
        String(req.params.warehouseId),
        getUserCtx(req),
      );
      sendSuccess(res, 'Warehouse layout retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async listZones(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
      const data = await WarehouseLocationService.listZones(warehouseId, getUserCtx(req));
      sendSuccess(res, 'Warehouse zones retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async createZone(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createZoneSchema.parse(req.body);
      const data = await WarehouseLocationService.createZone(body, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Warehouse zone created', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateZone(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateZoneSchema.parse(req.body);
      const data = await WarehouseLocationService.updateZone(
        String(req.params.id),
        body,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Warehouse zone updated', data);
    } catch (err) {
      next(err);
    }
  }

  static async createRack(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createRackSchema.parse(req.body);
      const data = await WarehouseLocationService.createRack(body, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Warehouse rack created', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async createShelf(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createShelfSchema.parse(req.body);
      const data = await WarehouseLocationService.createShelf(body, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Warehouse shelf created', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async listBins(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseLocationService.listBins(
        {
          warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
          isActive:
            req.query.isActive === 'true'
              ? true
              : req.query.isActive === 'false'
                ? false
                : undefined,
          storageCondition: req.query.storageCondition
            ? String(req.query.storageCondition)
            : undefined,
        },
        getUserCtx(req),
      );
      sendSuccess(res, 'Warehouse bins retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async createBin(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createBinSchema.parse(req.body);
      const data = await WarehouseLocationService.createBin(body, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Warehouse bin created', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateBin(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateBinSchema.parse(req.body);
      const data = await WarehouseLocationService.updateBin(
        String(req.params.id),
        body,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Warehouse bin updated', data);
    } catch (err) {
      next(err);
    }
  }

  // Location Stock & Movements
  static async listLocationStock(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseLocationService.listLocationStock(
        {
          warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
          binId: req.query.binId ? String(req.query.binId) : undefined,
          inventoryItemId: req.query.inventoryItemId
            ? String(req.query.inventoryItemId)
            : undefined,
          batchId: req.query.batchId ? String(req.query.batchId) : undefined,
        },
        getUserCtx(req),
      );
      sendSuccess(res, 'Location stock retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async listLocationMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseLocationService.listLocationMovements(
        {
          warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
          binId: req.query.binId ? String(req.query.binId) : undefined,
          inventoryItemId: req.query.inventoryItemId
            ? String(req.query.inventoryItemId)
            : undefined,
        },
        getUserCtx(req),
      );
      sendSuccess(res, 'Location movements retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async putAway(req: Request, res: Response, next: NextFunction) {
    try {
      const body = putAwaySchema.parse(req.body);
      const data = await WarehouseLocationService.putAway(body, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Stock put-away recorded', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async binTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const body = binTransferSchema.parse(req.body);
      const data = await WarehouseLocationService.binTransfer(
        body,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Bin-to-bin transfer completed', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async pickFromBin(req: Request, res: Response, next: NextFunction) {
    try {
      const body = pickFromBinSchema.parse(req.body);
      const data = await WarehouseLocationService.pickFromBin(
        body,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Bin pick recorded', data, 201);
    } catch (err) {
      next(err);
    }
  }

  // Barcodes & Scan Operations
  static async listBarcodes(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseBarcodeService.listBarcodes(
        {
          entityType: req.query.entityType
            ? (String(req.query.entityType) as BarcodeEntityType)
            : undefined,
          warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
        },
        getUserCtx(req),
      );
      sendSuccess(res, 'Barcode labels retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async createBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createBarcodeSchema.parse(req.body);
      const data = await WarehouseBarcodeService.createOrGetBarcode(
        body,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Barcode label generated', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async lookupBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const code = String(req.query.code || '');
      const data = await WarehouseBarcodeService.lookup(code, getUserCtx(req));
      sendSuccess(res, 'Barcode entity resolved', data);
    } catch (err) {
      next(err);
    }
  }

  static async executeScan(req: Request, res: Response, next: NextFunction) {
    try {
      const body = scanExecuteSchema.parse(req.body);
      const data = await WarehouseBarcodeService.executeScanOperation(
        body,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Scan operation completed', data, 201);
    } catch (err) {
      next(err);
    }
  }

  // Suggestions
  static async suggestPicking(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseSuggestionService.suggestPicking(
        {
          warehouseId: String(req.query.warehouseId || ''),
          inventoryItemId: String(req.query.inventoryItemId || ''),
          quantity: String(req.query.quantity || '1'),
        },
        getUserCtx(req),
      );
      sendSuccess(res, 'Picking suggestions generated', data);
    } catch (err) {
      next(err);
    }
  }

  static async suggestPutAway(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseSuggestionService.suggestPutAway(
        {
          warehouseId: String(req.query.warehouseId || ''),
          inventoryItemId: String(req.query.inventoryItemId || ''),
          batchId: req.query.batchId ? String(req.query.batchId) : undefined,
          quantity: String(req.query.quantity || '1'),
          storageCondition: req.query.storageCondition
            ? (String(req.query.storageCondition) as StorageCondition)
            : undefined,
          allergen: req.query.allergen ? String(req.query.allergen) : undefined,
        },
        getUserCtx(req),
      );
      sendSuccess(res, 'Put-away suggestions generated', data);
    } catch (err) {
      next(err);
    }
  }

  // Cycle Counting & Analytics
  static async listCycleCountPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseCycleCountService.listPlans(
        {
          warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
          status: req.query.status
            ? (String(req.query.status) as CycleCountPlanStatus)
            : undefined,
        },
        getUserCtx(req),
      );
      sendSuccess(res, 'Cycle count plans retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async createCycleCountPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createCycleCountPlanSchema.parse(req.body);
      const data = await WarehouseCycleCountService.createPlan(
        body,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Cycle count plan created', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateCycleCountPlanStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateCycleCountPlanStatusSchema.parse(req.body);
      const data = await WarehouseCycleCountService.updatePlanStatus(
        String(req.params.id),
        body.status,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Cycle count plan status updated', data);
    } catch (err) {
      next(err);
    }
  }

  static async generateCycleCountAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseCycleCountService.generateCycleCountAudit(
        String(req.params.planId),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Cycle count stock audit generated', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async recordCycleCount(req: Request, res: Response, next: NextFunction) {
    try {
      const body = recordCycleCountSchema.parse(req.body);
      const data = await WarehouseCycleCountService.recordCount(
        String(req.params.auditId),
        body,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Cycle count recorded', data);
    } catch (err) {
      next(err);
    }
  }

  static async investigateVariance(req: Request, res: Response, next: NextFunction) {
    try {
      const body = investigateVarianceSchema.parse(req.body);
      const data = await WarehouseCycleCountService.investigateVariance(
        String(req.params.auditId),
        body,
        getUserCtx(req),
      );
      sendSuccess(res, 'Variance investigation recorded', data);
    } catch (err) {
      next(err);
    }
  }

  static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WarehouseCycleCountService.getWarehouseAnalytics(
        String(req.params.warehouseId),
        getUserCtx(req),
      );
      sendSuccess(res, 'Warehouse analytics retrieved', data);
    } catch (err) {
      next(err);
    }
  }
}
