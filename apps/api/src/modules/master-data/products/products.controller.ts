import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data.utils';
import { toggleStatusSchema } from '../uom/uom.types';
import { ProductsService } from './products.service';
import {
  createProductCategorySchema,
  createProductSchema,
  createProductVariantSchema,
  updateProductCategorySchema,
  updateProductSchema,
  updateProductVariantSchema,
} from './products.types';

export class ProductsController {
  static async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const result = await ProductsService.listCategories(params);
      sendSuccess(res, 'Product categories retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ProductsService.getCategoryById(String(req.params.id));
      sendSuccess(res, 'Product category retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createProductCategorySchema.parse(req.body);
      const created = await ProductsService.createCategory(validated, getAuditMeta(req));
      sendSuccess(res, 'Product category created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateProductCategorySchema.parse(req.body);
      const updated = await ProductsService.updateCategory(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Product category updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setCategoryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await ProductsService.setCategoryStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Product category status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
      const result = await ProductsService.listProducts(params, categoryId);
      sendSuccess(res, 'Products retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ProductsService.getProductById(String(req.params.id));
      sendSuccess(res, 'Product retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createProductSchema.parse(req.body);
      const created = await ProductsService.createProduct(validated, getAuditMeta(req));
      sendSuccess(res, 'Product created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateProductSchema.parse(req.body);
      const updated = await ProductsService.updateProduct(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Product updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setProductStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await ProductsService.setProductStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Product status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async listVariants(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const productId = typeof req.query.productId === 'string' ? req.query.productId : undefined;
      const result = await ProductsService.listVariants(params, productId);
      sendSuccess(res, 'Product variants retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getVariantById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ProductsService.getVariantById(String(req.params.id));
      sendSuccess(res, 'Product variant retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async createVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createProductVariantSchema.parse(req.body);
      const created = await ProductsService.createVariant(validated, getAuditMeta(req));
      sendSuccess(res, 'Product variant created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateProductVariantSchema.parse(req.body);
      const updated = await ProductsService.updateVariant(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Product variant updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setVariantStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await ProductsService.setVariantStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Product variant status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }
}
