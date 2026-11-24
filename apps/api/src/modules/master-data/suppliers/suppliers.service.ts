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
import { CreateSupplierInput, UpdateSupplierInput } from './suppliers.types';

export class SuppliersService {
  static async listSuppliers(params: PaginationParams) {
    const where: Prisma.SupplierWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { legalName: { contains: params.search, mode: 'insensitive' } },
        { tradeName: { contains: params.search, mode: 'insensitive' } },
        { gstin: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: { addresses: true },
        skip: params.skip,
        take: params.take,
        orderBy: { legalName: 'asc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getSupplierById(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { addresses: true },
    });
    if (!supplier) throw new AppError('Supplier not found.', 404);
    return supplier;
  }

  static async createSupplier(input: CreateSupplierInput, meta: AuditMeta) {
    try {
      const created = await prisma.supplier.create({
        data: {
          code: input.code,
          legalName: input.legalName,
          tradeName: input.tradeName || null,
          contactName: input.contactName || null,
          email: input.email || null,
          phone: input.phone || null,
          gstin: input.gstin || null,
          pan: input.pan || null,
          paymentTermsDays: input.paymentTermsDays,
          addresses:
            input.addresses && input.addresses.length > 0
              ? {
                  create: input.addresses.map(a => ({
                    addressType: a.addressType,
                    addressLine1: a.addressLine1,
                    city: a.city,
                    state: a.state,
                    stateCode: a.stateCode,
                    pincode: a.pincode,
                    isDefault: a.isDefault,
                  })),
                }
              : undefined,
        },
        include: { addresses: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'Supplier',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Supplier');
    }
  }

  static async updateSupplier(id: string, input: UpdateSupplierInput, meta: AuditMeta) {
    try {
      const existing = await prisma.supplier.findUnique({
        where: { id },
        include: { addresses: true },
      });
      if (!existing) throw new AppError('Supplier not found.', 404);

      const updated = await prisma.$transaction(async tx => {
        if (input.addresses !== undefined) {
          await tx.supplierAddress.deleteMany({ where: { supplierId: id } });
        }

        return tx.supplier.update({
          where: { id },
          data: {
            ...(input.code !== undefined && { code: input.code }),
            ...(input.legalName !== undefined && { legalName: input.legalName }),
            ...(input.tradeName !== undefined && { tradeName: input.tradeName || null }),
            ...(input.contactName !== undefined && { contactName: input.contactName || null }),
            ...(input.email !== undefined && { email: input.email || null }),
            ...(input.phone !== undefined && { phone: input.phone || null }),
            ...(input.gstin !== undefined && { gstin: input.gstin || null }),
            ...(input.pan !== undefined && { pan: input.pan || null }),
            ...(input.paymentTermsDays !== undefined && {
              paymentTermsDays: input.paymentTermsDays,
            }),
            ...(input.addresses !== undefined && {
              addresses: {
                create: input.addresses.map(a => ({
                  addressType: a.addressType,
                  addressLine1: a.addressLine1,
                  city: a.city,
                  state: a.state,
                  stateCode: a.stateCode,
                  pincode: a.pincode,
                  isDefault: a.isDefault,
                })),
              },
            }),
          },
          include: { addresses: true },
        });
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'Supplier',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Supplier');
    }
  }

  static async setSupplierStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.supplier.findUnique({ where: { id } });
      if (!existing) throw new AppError('Supplier not found.', 404);

      const updated = await prisma.supplier.update({
        where: { id },
        data: { isActive },
        include: { addresses: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'Supplier',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated supplier' : 'Deactivated supplier',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Supplier');
    }
  }
}
