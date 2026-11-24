import { Prisma } from '@prisma/client';
import { prisma } from '../../../services/prisma.service';
import { AuditService } from '../../../services/audit.service';
import { AppError } from '../../../middleware/error.middleware';
import {
  AuditMeta,
  handlePrismaError,
  paginatedResult,
  PaginationParams,
  toPlainJson,
} from '../master-data.utils';
import {
  CreateProductCategoryInput,
  CreateProductInput,
  CreateProductVariantInput,
  UpdateProductCategoryInput,
  UpdateProductInput,
  UpdateProductVariantInput,
} from './products.types';

export class ProductsService {
  // --- Categories ---

  static async listCategories(params: PaginationParams) {
    const where: Prisma.ProductCategoryWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.productCategory.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
      }),
      prisma.productCategory.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getCategoryById(id: string) {
    const cat = await prisma.productCategory.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!cat) throw new AppError('Product category not found.', 404);
    return cat;
  }

  static async createCategory(input: CreateProductCategoryInput, meta: AuditMeta) {
    try {
      const created = await prisma.productCategory.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
        },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'ProductCategory',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Product category');
    }
  }

  static async updateCategory(id: string, input: UpdateProductCategoryInput, meta: AuditMeta) {
    try {
      const existing = await prisma.productCategory.findUnique({ where: { id } });
      if (!existing) throw new AppError('Product category not found.', 404);

      const updated = await prisma.productCategory.update({
        where: { id },
        data: input,
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'ProductCategory',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Product category');
    }
  }

  static async setCategoryStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.productCategory.findUnique({ where: { id } });
      if (!existing) throw new AppError('Product category not found.', 404);

      const updated = await prisma.productCategory.update({
        where: { id },
        data: { isActive },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'ProductCategory',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated product category' : 'Deactivated product category',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Product category');
    }
  }

  // --- Products ---

  private static async validateProductRefs(
    categoryId?: string,
    baseUomId?: string,
    taxRateId?: string,
  ) {
    if (categoryId) {
      const cat = await prisma.productCategory.findUnique({ where: { id: categoryId } });
      if (!cat) throw new AppError('Referenced product category not found.', 400);
      if (!cat.isActive) throw new AppError('Referenced product category is inactive.', 400);
    }
    if (baseUomId) {
      const uom = await prisma.unitOfMeasure.findUnique({ where: { id: baseUomId } });
      if (!uom) throw new AppError('Referenced base unit of measure not found.', 400);
      if (!uom.isActive) throw new AppError('Referenced base unit of measure is inactive.', 400);
    }
    if (taxRateId) {
      const tax = await prisma.taxRate.findUnique({ where: { id: taxRateId } });
      if (!tax) throw new AppError('Referenced tax rate not found.', 400);
      if (!tax.isActive) throw new AppError('Referenced tax rate is inactive.', 400);
    }
  }

  static async listProducts(params: PaginationParams, categoryId?: string) {
    const where: Prisma.ProductWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (categoryId) where.categoryId = categoryId;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { hsnCode: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          baseUom: true,
          taxRate: true,
          _count: { select: { variants: true } },
        },
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        baseUom: true,
        taxRate: true,
        variants: { include: { uom: true, inventoryItem: true } },
      },
    });
    if (!product) throw new AppError('Product not found.', 404);
    return product;
  }

  static async createProduct(input: CreateProductInput, meta: AuditMeta) {
    try {
      await this.validateProductRefs(input.categoryId, input.baseUomId, input.taxRateId);

      const created = await prisma.product.create({
        data: {
          categoryId: input.categoryId,
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          baseUomId: input.baseUomId,
          hsnCode: input.hsnCode,
          taxRateId: input.taxRateId,
        },
        include: { category: true, baseUom: true, taxRate: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'Product',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Product');
    }
  }

  static async updateProduct(id: string, input: UpdateProductInput, meta: AuditMeta) {
    try {
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) throw new AppError('Product not found.', 404);

      await this.validateProductRefs(input.categoryId, input.baseUomId, input.taxRateId);

      const updated = await prisma.product.update({
        where: { id },
        data: input,
        include: { category: true, baseUom: true, taxRate: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'Product',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Product');
    }
  }

  static async setProductStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) throw new AppError('Product not found.', 404);

      const updated = await prisma.product.update({
        where: { id },
        data: { isActive },
        include: { category: true, baseUom: true, taxRate: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'Product',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated product' : 'Deactivated product',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Product');
    }
  }

  // --- Product Variants ---

  private static async validateVariantRefs(productId?: string, uomId?: string) {
    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new AppError('Referenced product not found.', 400);
      if (!product.isActive) throw new AppError('Referenced product is inactive.', 400);
    }
    if (uomId) {
      const uom = await prisma.unitOfMeasure.findUnique({ where: { id: uomId } });
      if (!uom) throw new AppError('Referenced unit of measure not found.', 400);
      if (!uom.isActive) throw new AppError('Referenced unit of measure is inactive.', 400);
    }
  }

  static async listVariants(params: PaginationParams, productId?: string) {
    const where: Prisma.ProductVariantWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (productId) where.productId = productId;
    if (params.search) {
      where.OR = [
        { sku: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { barcode: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.productVariant.findMany({
        where,
        include: {
          product: { include: { category: true, taxRate: true } },
          uom: true,
          inventoryItem: true,
        },
        skip: params.skip,
        take: params.take,
        orderBy: { sku: 'asc' },
      }),
      prisma.productVariant.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getVariantById(id: string) {
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: { include: { category: true, taxRate: true } },
        uom: true,
        inventoryItem: true,
        boms: true,
      },
    });
    if (!variant) throw new AppError('Product variant not found.', 404);
    return variant;
  }

  static async createVariant(input: CreateProductVariantInput, meta: AuditMeta) {
    try {
      await this.validateVariantRefs(input.productId, input.uomId);

      const created = await prisma.$transaction(async tx => {
        const variant = await tx.productVariant.create({
          data: {
            productId: input.productId,
            sku: input.sku,
            name: input.name,
            netWeightGrams: new Prisma.Decimal(input.netWeightGrams),
            uomId: input.uomId,
            defaultSellingPrice: new Prisma.Decimal(input.defaultSellingPrice),
            barcode: input.barcode || null,
          },
        });

        await tx.inventoryItem.create({
          data: {
            itemType: 'FINISHED_GOODS',
            productVariantId: variant.id,
            code: variant.sku,
            name: variant.name,
            uomId: variant.uomId,
            valuationMethod: 'BATCH_ACTUAL',
          },
        });

        return tx.productVariant.findUniqueOrThrow({
          where: { id: variant.id },
          include: { product: true, uom: true, inventoryItem: true },
        });
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'ProductVariant',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Product variant');
    }
  }

  static async updateVariant(id: string, input: UpdateProductVariantInput, meta: AuditMeta) {
    try {
      const existing = await prisma.productVariant.findUnique({ where: { id } });
      if (!existing) throw new AppError('Product variant not found.', 404);

      await this.validateVariantRefs(input.productId, input.uomId);

      const updated = await prisma.$transaction(async tx => {
        const variant = await tx.productVariant.update({
          where: { id },
          data: {
            ...(input.productId !== undefined && { productId: input.productId }),
            ...(input.sku !== undefined && { sku: input.sku }),
            ...(input.name !== undefined && { name: input.name }),
            ...(input.netWeightGrams !== undefined && {
              netWeightGrams: new Prisma.Decimal(input.netWeightGrams),
            }),
            ...(input.uomId !== undefined && { uomId: input.uomId }),
            ...(input.defaultSellingPrice !== undefined && {
              defaultSellingPrice: new Prisma.Decimal(input.defaultSellingPrice),
            }),
            ...(input.barcode !== undefined && { barcode: input.barcode || null }),
          },
        });

        await tx.inventoryItem.updateMany({
          where: { productVariantId: variant.id },
          data: {
            code: variant.sku,
            name: variant.name,
            uomId: variant.uomId,
          },
        });

        return tx.productVariant.findUniqueOrThrow({
          where: { id: variant.id },
          include: { product: true, uom: true, inventoryItem: true },
        });
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'ProductVariant',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Product variant');
    }
  }

  static async setVariantStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.productVariant.findUnique({ where: { id } });
      if (!existing) throw new AppError('Product variant not found.', 404);

      const updated = await prisma.$transaction(async tx => {
        const variant = await tx.productVariant.update({
          where: { id },
          data: { isActive },
          include: { product: true, uom: true, inventoryItem: true },
        });
        await tx.inventoryItem.updateMany({
          where: { productVariantId: id },
          data: { isActive },
        });
        return variant;
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'ProductVariant',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated product variant' : 'Deactivated product variant',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Product variant');
    }
  }
}
