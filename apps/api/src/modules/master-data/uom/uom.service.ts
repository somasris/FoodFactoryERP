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
  ConvertQuantityInput,
  CreateUnitConversionInput,
  CreateUomInput,
  UpdateUnitConversionInput,
  UpdateUomInput,
} from './uom.types';

export class UomService {
  static async listUoms(params: PaginationParams, category?: string) {
    const where: Prisma.UnitOfMeasureWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (category) where.category = category.toUpperCase();
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { symbol: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.unitOfMeasure.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
      }),
      prisma.unitOfMeasure.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getUomById(id: string) {
    const uom = await prisma.unitOfMeasure.findUnique({
      where: { id },
      include: {
        conversionsFrom: { include: { toUom: true } },
        conversionsTo: { include: { fromUom: true } },
      },
    });
    if (!uom) {
      throw new AppError('Unit of measure not found.', 404);
    }
    return uom;
  }

  static async createUom(input: CreateUomInput, meta: AuditMeta) {
    try {
      const created = await prisma.unitOfMeasure.create({
        data: {
          code: input.code,
          name: input.name,
          symbol: input.symbol,
          category: input.category,
          isBaseUnit: input.isBaseUnit,
          decimalPlaces: input.decimalPlaces,
        },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'UnitOfMeasure',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Unit of measure');
    }
  }

  static async updateUom(id: string, input: UpdateUomInput, meta: AuditMeta) {
    try {
      const existing = await prisma.unitOfMeasure.findUnique({ where: { id } });
      if (!existing) throw new AppError('Unit of measure not found.', 404);

      const updated = await prisma.unitOfMeasure.update({
        where: { id },
        data: input,
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'UnitOfMeasure',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Unit of measure');
    }
  }

  static async setUomStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.unitOfMeasure.findUnique({ where: { id } });
      if (!existing) throw new AppError('Unit of measure not found.', 404);

      const updated = await prisma.unitOfMeasure.update({
        where: { id },
        data: { isActive },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'UnitOfMeasure',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated unit of measure' : 'Deactivated unit of measure',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Unit of measure');
    }
  }

  // --- Unit Conversions ---

  static async listConversions(params: PaginationParams) {
    const where: Prisma.UnitConversionWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { fromUom: { code: { contains: params.search, mode: 'insensitive' } } },
        { fromUom: { name: { contains: params.search, mode: 'insensitive' } } },
        { toUom: { code: { contains: params.search, mode: 'insensitive' } } },
        { toUom: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.unitConversion.findMany({
        where,
        include: { fromUom: true, toUom: true },
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.unitConversion.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getConversionById(id: string) {
    const conversion = await prisma.unitConversion.findUnique({
      where: { id },
      include: { fromUom: true, toUom: true },
    });
    if (!conversion) {
      throw new AppError('Unit conversion not found.', 404);
    }
    return conversion;
  }

  static async createConversion(input: CreateUnitConversionInput, meta: AuditMeta) {
    try {
      if (input.fromUomId === input.toUomId) {
        throw new AppError('Source and target units of measure must be different.', 400);
      }

      const [fromUom, toUom] = await Promise.all([
        prisma.unitOfMeasure.findUnique({ where: { id: input.fromUomId } }),
        prisma.unitOfMeasure.findUnique({ where: { id: input.toUomId } }),
      ]);

      if (!fromUom || !toUom) {
        throw new AppError('Referenced unit of measure not found.', 400);
      }

      if (!fromUom.isActive || !toUom.isActive) {
        throw new AppError('Cannot create conversion for an inactive unit of measure.', 400);
      }

      if (
        fromUom.category !== 'GENERAL' &&
        toUom.category !== 'GENERAL' &&
        fromUom.category !== toUom.category
      ) {
        throw new AppError(
          `Incompatible unit categories: cannot convert ${fromUom.category} (${fromUom.code}) to ${toUom.category} (${toUom.code}).`,
          400,
        );
      }

      const created = await prisma.unitConversion.create({
        data: {
          fromUomId: input.fromUomId,
          toUomId: input.toUomId,
          multiplier: new Prisma.Decimal(input.multiplier),
        },
        include: { fromUom: true, toUom: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'UnitConversion',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Unit conversion');
    }
  }

  static async updateConversion(id: string, input: UpdateUnitConversionInput, meta: AuditMeta) {
    try {
      const existing = await prisma.unitConversion.findUnique({ where: { id } });
      if (!existing) throw new AppError('Unit conversion not found.', 404);

      const updated = await prisma.unitConversion.update({
        where: { id },
        data: { multiplier: new Prisma.Decimal(input.multiplier) },
        include: { fromUom: true, toUom: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'UnitConversion',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Unit conversion');
    }
  }

  static async setConversionStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.unitConversion.findUnique({ where: { id } });
      if (!existing) throw new AppError('Unit conversion not found.', 404);

      const updated = await prisma.unitConversion.update({
        where: { id },
        data: { isActive },
        include: { fromUom: true, toUom: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'UnitConversion',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated unit conversion' : 'Deactivated unit conversion',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Unit conversion');
    }
  }

  static async convertQuantity(input: ConvertQuantityInput) {
    const qty = new Prisma.Decimal(input.quantity);

    if (input.fromUomId === input.toUomId) {
      return {
        fromUomId: input.fromUomId,
        toUomId: input.toUomId,
        inputQuantity: qty.toString(),
        multiplier: '1',
        convertedQuantity: qty.toString(),
      };
    }

    const direct = await prisma.unitConversion.findUnique({
      where: {
        fromUomId_toUomId: {
          fromUomId: input.fromUomId,
          toUomId: input.toUomId,
        },
      },
    });

    if (direct && direct.isActive) {
      const converted = qty.mul(direct.multiplier);
      return {
        fromUomId: input.fromUomId,
        toUomId: input.toUomId,
        inputQuantity: qty.toString(),
        multiplier: direct.multiplier.toString(),
        convertedQuantity: converted.toDecimalPlaces(6).toString(),
      };
    }

    const inverse = await prisma.unitConversion.findUnique({
      where: {
        fromUomId_toUomId: {
          fromUomId: input.toUomId,
          toUomId: input.fromUomId,
        },
      },
    });

    if (inverse && inverse.isActive) {
      const effectiveMultiplier = new Prisma.Decimal(1).div(inverse.multiplier);
      const converted = qty.div(inverse.multiplier);
      return {
        fromUomId: input.fromUomId,
        toUomId: input.toUomId,
        inputQuantity: qty.toString(),
        multiplier: effectiveMultiplier.toDecimalPlaces(6).toString(),
        convertedQuantity: converted.toDecimalPlaces(6).toString(),
      };
    }

    throw new AppError('No active unit conversion rule found between the specified units.', 400);
  }
}
