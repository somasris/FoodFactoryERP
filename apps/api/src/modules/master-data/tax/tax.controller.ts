import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data.utils';
import { toggleStatusSchema } from '../uom/uom.types';
import { TaxService } from './tax.service';
import {
  createTaxConfigSchema,
  createTaxRateSchema,
  updateTaxConfigSchema,
  updateTaxRateSchema,
} from './tax.types';

export class TaxController {
  static async listTaxRates(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const result = await TaxService.listTaxRates(params);
      sendSuccess(res, 'Tax rates retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getTaxRateById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await TaxService.getTaxRateById(String(req.params.id));
      sendSuccess(res, 'Tax rate retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async createTaxRate(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createTaxRateSchema.parse(req.body);
      const created = await TaxService.createTaxRate(validated, getAuditMeta(req));
      sendSuccess(res, 'Tax rate created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateTaxRate(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateTaxRateSchema.parse(req.body);
      const updated = await TaxService.updateTaxRate(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Tax rate updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setTaxRateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await TaxService.setTaxRateStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Tax rate status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async listTaxConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const result = await TaxService.listTaxConfigs(params);
      sendSuccess(res, 'Tax configurations retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getTaxConfigById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await TaxService.getTaxConfigById(String(req.params.id));
      sendSuccess(res, 'Tax configuration retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async createTaxConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createTaxConfigSchema.parse(req.body);
      const created = await TaxService.createTaxConfig(validated, getAuditMeta(req));
      sendSuccess(res, 'Tax configuration created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateTaxConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateTaxConfigSchema.parse(req.body);
      const updated = await TaxService.updateTaxConfig(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Tax configuration updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setTaxConfigStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await TaxService.setTaxConfigStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Tax configuration status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }
}
