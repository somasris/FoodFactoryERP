import { ItemType, MaterialType, Prisma } from '@prisma/client';
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
  CreateRawMaterialCategoryInput,
  CreateRawMaterialInput,
  UpdateRawMaterialCategoryInput,
  UpdateRawMaterialInput,
} from './raw-materials.types';

const mapMaterialTypeToItemType = (materialType: MaterialType): ItemType => {
  return materialType === 'RAW_INGREDIENT' ? 'RAW_MATERIAL' : 'PACKAGING';
};

export class RawMaterialsService {
  // --- Categories ---

  static async listCategories(params: PaginationParams) {
    const where: Prisma.RawMaterialCategoryWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.rawMaterialCategory.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
      }),
      prisma.rawMaterialCategory.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getCategoryById(id: string) {
    const cat = await prisma.rawMaterialCategory.findUnique({
      where: { id },
      include: { materials: true },
    });
    if (!cat) throw new AppError('Raw material category not found.', 404);
    return cat;
  }

  static async createCategory(input: CreateRawMaterialCategoryInput, meta: AuditMeta) {
    try {
      const created = await prisma.rawMaterialCategory.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
        },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'RawMaterialCategory',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Raw material category');
    }
  }

  static async updateCategory(id: string, input: UpdateRawMaterialCategoryInput, meta: AuditMeta) {
    try {
      const existing = await prisma.rawMaterialCategory.findUnique({ where: { id } });
      if (!existing) throw new AppError('Raw material category not found.', 404);

      const updated = await prisma.rawMaterialCategory.update({
        where: { id },
        data: input,
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'RawMaterialCategory',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Raw material category');
    }
  }

  static async setCategoryStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.rawMaterialCategory.findUnique({ where: { id } });
      if (!existing) throw new AppError('Raw material category not found.', 404);

      const updated = await prisma.rawMaterialCategory.update({
        where: { id },
        data: { isActive },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'RawMaterialCategory',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive
          ? 'Activated raw material category'
          : 'Deactivated raw material category',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Raw material category');
    }
  }

  // --- Raw Materials ---

  private static async validateReferences(
    categoryId?: string,
    uomId?: string,
    taxRateId?: string,
  ) {
    if (categoryId) {
      const cat = await prisma.rawMaterialCategory.findUnique({ where: { id: categoryId } });
      if (!cat) throw new AppError('Referenced raw material category not found.', 400);
      if (!cat.isActive) throw new AppError('Referenced raw material category is inactive.', 400);
    }
    if (uomId) {
      const uom = await prisma.unitOfMeasure.findUnique({ where: { id: uomId } });
      if (!uom) throw new AppError('Referenced unit of measure not found.', 400);
      if (!uom.isActive) throw new AppError('Referenced unit of measure is inactive.', 400);
    }
    if (taxRateId) {
      const tax = await prisma.taxRate.findUnique({ where: { id: taxRateId } });
      if (!tax) throw new AppError('Referenced tax rate not found.', 400);
      if (!tax.isActive) throw new AppError('Referenced tax rate is inactive.', 400);
    }
  }

  static async listMaterials(
    params: PaginationParams,
    filters?: { categoryId?: string; materialType?: string },
  ) {
    const where: Prisma.RawMaterialWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.materialType) where.materialType = filters.materialType as MaterialType;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { hsnCode: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.rawMaterial.findMany({
        where,
        include: { category: true, uom: true, taxRate: true, inventoryItem: true },
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
      }),
      prisma.rawMaterial.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getMaterialById(id: string) {
    const material = await prisma.rawMaterial.findUnique({
      where: { id },
      include: { category: true, uom: true, taxRate: true, inventoryItem: true },
    });
    if (!material) throw new AppError('Raw material not found.', 404);
    return material;
  }

  static async createMaterial(input: CreateRawMaterialInput, meta: AuditMeta) {
    try {
      await this.validateReferences(input.categoryId, input.uomId, input.taxRateId);

      const created = await prisma.$transaction(async tx => {
        const material = await tx.rawMaterial.create({
          data: {
            categoryId: input.categoryId,
            code: input.code,
            name: input.name,
            description: input.description ?? null,
            materialType: input.materialType,
            uomId: input.uomId,
            hsnCode: input.hsnCode,
            taxRateId: input.taxRateId,
            minStockAlert: new Prisma.Decimal(input.minStockAlert),
            reorderQuantity: input.reorderQuantity
              ? new Prisma.Decimal(input.reorderQuantity)
              : null,
            allergenStatus: input.allergenStatus ?? 'UNKNOWN',
            allergens: Array.from(new Set(input.allergens ?? [])),
            crossContactAllergens: Array.from(new Set(input.crossContactAllergens ?? [])),
          },
        });

        await tx.inventoryItem.create({
          data: {
            itemType: mapMaterialTypeToItemType(material.materialType),
            rawMaterialId: material.id,
            code: material.code,
            name: material.name,
            uomId: material.uomId,
            valuationMethod: 'MWAC',
          },
        });

        return tx.rawMaterial.findUniqueOrThrow({
          where: { id: material.id },
          include: { category: true, uom: true, taxRate: true, inventoryItem: true },
        });
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'RawMaterial',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Raw material');
    }
  }

  static async updateMaterial(id: string, input: UpdateRawMaterialInput, meta: AuditMeta) {
    try {
      const existing = await prisma.rawMaterial.findUnique({ where: { id } });
      if (!existing) throw new AppError('Raw material not found.', 404);

      await this.validateReferences(input.categoryId, input.uomId, input.taxRateId);

      const updated = await prisma.$transaction(async tx => {
        const material = await tx.rawMaterial.update({
          where: { id },
          data: {
            ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
            ...(input.code !== undefined && { code: input.code }),
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.materialType !== undefined && { materialType: input.materialType }),
            ...(input.uomId !== undefined && { uomId: input.uomId }),
            ...(input.hsnCode !== undefined && { hsnCode: input.hsnCode }),
            ...(input.taxRateId !== undefined && { taxRateId: input.taxRateId }),
            ...(input.minStockAlert !== undefined && {
              minStockAlert: new Prisma.Decimal(input.minStockAlert),
            }),
            ...(input.reorderQuantity !== undefined && {
              reorderQuantity: input.reorderQuantity
                ? new Prisma.Decimal(input.reorderQuantity)
                : null,
            }),
            ...(input.allergenStatus !== undefined && { allergenStatus: input.allergenStatus }),
            ...(input.allergens !== undefined && {
              allergens: Array.from(new Set(input.allergens)),
            }),
            ...(input.crossContactAllergens !== undefined && {
              crossContactAllergens: Array.from(new Set(input.crossContactAllergens)),
            }),
          },
        });

        await tx.inventoryItem.updateMany({
          where: { rawMaterialId: material.id },
          data: {
            code: material.code,
            name: material.name,
            uomId: material.uomId,
            itemType: mapMaterialTypeToItemType(material.materialType),
          },
        });

        return tx.rawMaterial.findUniqueOrThrow({
          where: { id: material.id },
          include: { category: true, uom: true, taxRate: true, inventoryItem: true },
        });
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'RawMaterial',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Raw material');
    }
  }

  static async setMaterialStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.rawMaterial.findUnique({ where: { id } });
      if (!existing) throw new AppError('Raw material not found.', 404);

      const updated = await prisma.$transaction(async tx => {
        const material = await tx.rawMaterial.update({
          where: { id },
          data: { isActive },
          include: { category: true, uom: true, taxRate: true, inventoryItem: true },
        });
        await tx.inventoryItem.updateMany({
          where: { rawMaterialId: id },
          data: { isActive },
        });
        return material;
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'RawMaterial',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated raw material' : 'Deactivated raw material',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Raw material');
    }
  }
}
