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
  CreateTaxConfigInput,
  CreateTaxRateInput,
  UpdateTaxConfigInput,
  UpdateTaxRateInput,
} from './tax.types';

export class TaxService {
  static async listTaxRates(params: PaginationParams) {
    const where: Prisma.TaxRateWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.taxRate.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { ratePercentage: 'asc' },
      }),
      prisma.taxRate.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getTaxRateById(id: string) {
    const rate = await prisma.taxRate.findUnique({
      where: { id },
      include: { configurations: true },
    });
    if (!rate) throw new AppError('Tax rate not found.', 404);
    return rate;
  }

  static async createTaxRate(input: CreateTaxRateInput, meta: AuditMeta) {
    try {
      const created = await prisma.taxRate.create({
        data: {
          code: input.code,
          name: input.name,
          ratePercentage: new Prisma.Decimal(input.ratePercentage),
          cgstPercentage: new Prisma.Decimal(input.cgstPercentage),
          sgstPercentage: new Prisma.Decimal(input.sgstPercentage),
          igstPercentage: new Prisma.Decimal(input.igstPercentage),
        },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'TaxRate',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Tax rate');
    }
  }

  static async updateTaxRate(id: string, input: UpdateTaxRateInput, meta: AuditMeta) {
    try {
      const existing = await prisma.taxRate.findUnique({ where: { id } });
      if (!existing) throw new AppError('Tax rate not found.', 404);

      const rate = new Prisma.Decimal(input.ratePercentage ?? existing.ratePercentage);
      const cgst = new Prisma.Decimal(input.cgstPercentage ?? existing.cgstPercentage);
      const sgst = new Prisma.Decimal(input.sgstPercentage ?? existing.sgstPercentage);
      const igst = new Prisma.Decimal(input.igstPercentage ?? existing.igstPercentage);

      if (!cgst.add(sgst).equals(rate)) {
        throw new AppError('CGST + SGST must equal total rate percentage.', 400);
      }
      if (!igst.equals(rate)) {
        throw new AppError('IGST must equal total rate percentage.', 400);
      }

      const updated = await prisma.taxRate.update({
        where: { id },
        data: {
          ...(input.code !== undefined && { code: input.code }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.ratePercentage !== undefined && { ratePercentage: rate }),
          ...(input.cgstPercentage !== undefined && { cgstPercentage: cgst }),
          ...(input.sgstPercentage !== undefined && { sgstPercentage: sgst }),
          ...(input.igstPercentage !== undefined && { igstPercentage: igst }),
        },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'TaxRate',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Tax rate');
    }
  }

  static async setTaxRateStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.taxRate.findUnique({ where: { id } });
      if (!existing) throw new AppError('Tax rate not found.', 404);

      const updated = await prisma.taxRate.update({
        where: { id },
        data: { isActive },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'TaxRate',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated tax rate' : 'Deactivated tax rate',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Tax rate');
    }
  }

  // --- Tax Configurations (HSN mapping with effective date overlap check) ---

  private static async checkOverlap(
    hsnCode: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    excludeId?: string,
  ) {
    const candidates = await prisma.taxConfiguration.findMany({
      where: {
        hsnCode,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    for (const existing of candidates) {
      const existingEnd = existing.effectiveTo;
      const newEnd = effectiveTo;
      // Overlap if existing.effectiveFrom <= newEnd (or newEnd is null)
      // AND (existingEnd is null OR existingEnd >= effectiveFrom)
      const startsBeforeNewEnds = !newEnd || existing.effectiveFrom <= newEnd;
      const endsAfterNewStarts = !existingEnd || existingEnd >= effectiveFrom;
      if (startsBeforeNewEnds && endsAfterNewStarts) {
        throw new AppError(
          `Overlapping active tax configuration already exists for HSN code ${hsnCode}.`,
          409,
        );
      }
    }
  }

  static async listTaxConfigs(params: PaginationParams) {
    const where: Prisma.TaxConfigurationWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { hsnCode: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.taxConfiguration.findMany({
        where,
        include: { taxRate: true },
        skip: params.skip,
        take: params.take,
        orderBy: [{ hsnCode: 'asc' }, { effectiveFrom: 'desc' }],
      }),
      prisma.taxConfiguration.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getTaxConfigById(id: string) {
    const config = await prisma.taxConfiguration.findUnique({
      where: { id },
      include: { taxRate: true },
    });
    if (!config) throw new AppError('Tax configuration not found.', 404);
    return config;
  }

  static async createTaxConfig(input: CreateTaxConfigInput, meta: AuditMeta) {
    try {
      const taxRate = await prisma.taxRate.findUnique({ where: { id: input.taxRateId } });
      if (!taxRate) throw new AppError('Referenced tax rate not found.', 400);
      if (!taxRate.isActive) throw new AppError('Referenced tax rate is inactive.', 400);

      const effectiveFrom = input.effectiveFrom ?? new Date();
      const effectiveTo = input.effectiveTo ?? null;

      await this.checkOverlap(input.hsnCode, effectiveFrom, effectiveTo);

      const created = await prisma.taxConfiguration.create({
        data: {
          hsnCode: input.hsnCode,
          description: input.description ?? null,
          taxRateId: input.taxRateId,
          effectiveFrom,
          effectiveTo,
        },
        include: { taxRate: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'TaxConfiguration',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Tax configuration');
    }
  }

  static async updateTaxConfig(id: string, input: UpdateTaxConfigInput, meta: AuditMeta) {
    try {
      const existing = await prisma.taxConfiguration.findUnique({ where: { id } });
      if (!existing) throw new AppError('Tax configuration not found.', 404);

      if (input.taxRateId) {
        const taxRate = await prisma.taxRate.findUnique({ where: { id: input.taxRateId } });
        if (!taxRate) throw new AppError('Referenced tax rate not found.', 400);
        if (!taxRate.isActive) throw new AppError('Referenced tax rate is inactive.', 400);
      }

      const hsnCode = input.hsnCode ?? existing.hsnCode;
      const effectiveFrom = input.effectiveFrom ?? existing.effectiveFrom;
      const effectiveTo =
        input.effectiveTo !== undefined ? input.effectiveTo : existing.effectiveTo;

      if (effectiveTo && effectiveTo < effectiveFrom) {
        throw new AppError('Effective To date must be on or after Effective From date.', 400);
      }

      if (existing.isActive) {
        await this.checkOverlap(hsnCode, effectiveFrom, effectiveTo, id);
      }

      const updated = await prisma.taxConfiguration.update({
        where: { id },
        data: {
          hsnCode,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.taxRateId !== undefined && { taxRateId: input.taxRateId }),
          effectiveFrom,
          effectiveTo,
        },
        include: { taxRate: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'TaxConfiguration',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Tax configuration');
    }
  }

  static async setTaxConfigStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.taxConfiguration.findUnique({ where: { id } });
      if (!existing) throw new AppError('Tax configuration not found.', 404);

      if (isActive && !existing.isActive) {
        await this.checkOverlap(
          existing.hsnCode,
          existing.effectiveFrom,
          existing.effectiveTo,
          id,
        );
      }

      const updated = await prisma.taxConfiguration.update({
        where: { id },
        data: { isActive },
        include: { taxRate: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'TaxConfiguration',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated tax configuration' : 'Deactivated tax configuration',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Tax configuration');
    }
  }
}
