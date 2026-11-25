import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data.utils';
import { toggleStatusSchema } from '../uom/uom.types';
import { BomsService } from './boms.service';
import {
  createBomSchema,
  createBomVersionBodySchema,
  obsoleteBomVersionSchema,
  updateBomHeaderSchema,
  updateBomVersionSchema,
} from './boms.types';

export class BomsController {
  static async listInventoryItems(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const itemType = typeof req.query.itemType === 'string' ? req.query.itemType : undefined;
      const result = await BomsService.listInventoryItems(params, itemType);
      sendSuccess(res, 'Inventory items retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const productVariantId =
        typeof req.query.productVariantId === 'string' ? req.query.productVariantId : undefined;
      const result = await BomsService.listBoms(params, productVariantId);
      sendSuccess(res, 'Bills of materials retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const bom = await BomsService.getBomById(String(req.params.id));
      sendSuccess(res, 'Bill of materials retrieved successfully', bom);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createBomSchema.parse(req.body);
      const created = await BomsService.createBom(validated, getAuditMeta(req));
      sendSuccess(res, 'Bill of materials created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateHeader(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateBomHeaderSchema.parse(req.body);
      const updated = await BomsService.updateBomHeader(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Bill of materials updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await BomsService.setBomStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Bill of materials status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async createVersion(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createBomVersionBodySchema.parse(req.body);
      const created = await BomsService.createVersion(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'BOM version created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateVersion(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateBomVersionSchema.parse(req.body);
      const updated = await BomsService.updateDraftVersion(
        String(req.params.id),
        String(req.params.versionId),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'BOM version updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async activateVersion(req: Request, res: Response, next: NextFunction) {
    try {
      const activated = await BomsService.activateVersion(
        String(req.params.id),
        String(req.params.versionId),
        getAuditMeta(req),
      );
      sendSuccess(res, 'BOM version activated successfully', activated);
    } catch (error) {
      next(error);
    }
  }

  static async obsoleteVersion(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = obsoleteBomVersionSchema.parse(req.body || {});
      const obsoleted = await BomsService.obsoleteVersion(
        String(req.params.id),
        String(req.params.versionId),
        reason,
        getAuditMeta(req),
      );
      sendSuccess(res, 'BOM version marked obsolete successfully', obsoleted);
    } catch (error) {
      next(error);
    }
  }

  static async getVersionCostEstimate(req: Request, res: Response, next: NextFunction) {
    try {
      const batchQuantity =
        typeof req.query.batchQuantity === 'string' && req.query.batchQuantity.trim()
          ? req.query.batchQuantity.trim()
          : undefined;
      const estimate = await BomsService.getVersionCostEstimate(
        String(req.params.id),
        String(req.params.versionId),
        batchQuantity,
      );
      sendSuccess(res, 'BOM cost estimate calculated successfully', estimate);
    } catch (error) {
      next(error);
    }
  }

  static async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await BomsService.getBomAuditHistory(String(req.params.id));
      sendSuccess(res, 'BOM audit history retrieved successfully', history);
    } catch (error) {
      next(error);
    }
  }
}
