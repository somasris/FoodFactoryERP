import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data.utils';
import { toggleStatusSchema } from '../uom/uom.types';
import { SuppliersService } from './suppliers.service';
import { createSupplierSchema, updateSupplierSchema } from './suppliers.types';

export class SuppliersController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const result = await SuppliersService.listSuppliers(params);
      sendSuccess(res, 'Suppliers retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await SuppliersService.getSupplierById(String(req.params.id));
      sendSuccess(res, 'Supplier retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createSupplierSchema.parse(req.body);
      const created = await SuppliersService.createSupplier(validated, getAuditMeta(req));
      sendSuccess(res, 'Supplier created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateSupplierSchema.parse(req.body);
      const updated = await SuppliersService.updateSupplier(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Supplier updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await SuppliersService.setSupplierStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Supplier status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }
}
