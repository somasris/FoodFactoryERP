import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data.utils';
import { toggleStatusSchema } from '../uom/uom.types';
import { WarehousesService } from './warehouses.service';
import { createWarehouseSchema, updateWarehouseSchema } from './warehouses.types';

export class WarehousesController {
  static async listFactories(_req: Request, res: Response, next: NextFunction) {
    try {
      const factories = await WarehousesService.listFactories();
      sendSuccess(res, 'Factories retrieved successfully', factories);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const warehouseType =
        typeof req.query.warehouseType === 'string' ? req.query.warehouseType : undefined;
      const result = await WarehousesService.listWarehouses(
        params,
        {
          userId: req.user!.userId,
          roles: req.user!.roles || [],
        },
        warehouseType,
      );
      sendSuccess(res, 'Warehouses retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await WarehousesService.getWarehouseById(String(req.params.id));
      sendSuccess(res, 'Warehouse retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createWarehouseSchema.parse(req.body);
      const created = await WarehousesService.createWarehouse(validated, getAuditMeta(req));
      sendSuccess(res, 'Warehouse created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateWarehouseSchema.parse(req.body);
      const updated = await WarehousesService.updateWarehouse(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Warehouse updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await WarehousesService.setWarehouseStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Warehouse status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }
}
