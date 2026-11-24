import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data.utils';
import { toggleStatusSchema } from '../uom/uom.types';
import { RawMaterialsService } from './raw-materials.service';
import {
  createRawMaterialCategorySchema,
  createRawMaterialSchema,
  updateRawMaterialCategorySchema,
  updateRawMaterialSchema,
} from './raw-materials.types';

export class RawMaterialsController {
  static async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const result = await RawMaterialsService.listCategories(params);
      sendSuccess(res, 'Raw material categories retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await RawMaterialsService.getCategoryById(String(req.params.id));
      sendSuccess(res, 'Raw material category retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createRawMaterialCategorySchema.parse(req.body);
      const created = await RawMaterialsService.createCategory(validated, getAuditMeta(req));
      sendSuccess(res, 'Raw material category created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateRawMaterialCategorySchema.parse(req.body);
      const updated = await RawMaterialsService.updateCategory(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Raw material category updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setCategoryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await RawMaterialsService.setCategoryStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Raw material category status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async listMaterials(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
      const materialType =
        typeof req.query.materialType === 'string' ? req.query.materialType : undefined;
      const result = await RawMaterialsService.listMaterials(params, { categoryId, materialType });
      sendSuccess(res, 'Raw materials retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getMaterialById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await RawMaterialsService.getMaterialById(String(req.params.id));
      sendSuccess(res, 'Raw material retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async createMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createRawMaterialSchema.parse(req.body);
      const created = await RawMaterialsService.createMaterial(validated, getAuditMeta(req));
      sendSuccess(res, 'Raw material created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateRawMaterialSchema.parse(req.body);
      const updated = await RawMaterialsService.updateMaterial(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Raw material updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setMaterialStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await RawMaterialsService.setMaterialStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Raw material status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }
}
