import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data.utils';
import { UomService } from './uom.service';
import {
  convertQuantitySchema,
  createUnitConversionSchema,
  createUomSchema,
  toggleStatusSchema,
  updateUnitConversionSchema,
  updateUomSchema,
} from './uom.types';

export class UomController {
  static async listUoms(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const result = await UomService.listUoms(params, category);
      sendSuccess(res, 'Units of measure retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getUomById(req: Request, res: Response, next: NextFunction) {
    try {
      const uom = await UomService.getUomById(String(req.params.id));
      sendSuccess(res, 'Unit of measure retrieved successfully', uom);
    } catch (error) {
      next(error);
    }
  }

  static async createUom(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createUomSchema.parse(req.body);
      const created = await UomService.createUom(validated, getAuditMeta(req));
      sendSuccess(res, 'Unit of measure created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateUom(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateUomSchema.parse(req.body);
      const updated = await UomService.updateUom(String(req.params.id), validated, getAuditMeta(req));
      sendSuccess(res, 'Unit of measure updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setUomStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await UomService.setUomStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Unit of measure status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async listConversions(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const result = await UomService.listConversions(params);
      sendSuccess(res, 'Unit conversions retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getConversionById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await UomService.getConversionById(String(req.params.id));
      sendSuccess(res, 'Unit conversion retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async createConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createUnitConversionSchema.parse(req.body);
      const created = await UomService.createConversion(validated, getAuditMeta(req));
      sendSuccess(res, 'Unit conversion created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateUnitConversionSchema.parse(req.body);
      const updated = await UomService.updateConversion(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Unit conversion updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setConversionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await UomService.setConversionStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Unit conversion status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async convertQuantity(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = convertQuantitySchema.parse(req.body);
      const result = await UomService.convertQuantity(validated);
      sendSuccess(res, 'Quantity converted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
