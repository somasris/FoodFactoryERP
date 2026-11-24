import { CustomerType, Prisma } from '@prisma/client';
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
import { CreateCustomerInput, UpdateCustomerInput } from './customers.types';

export class CustomersService {
  static async listCustomers(params: PaginationParams, customerType?: string) {
    const where: Prisma.CustomerWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (customerType) where.customerType = customerType as CustomerType;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { legalName: { contains: params.search, mode: 'insensitive' } },
        { tradeName: { contains: params.search, mode: 'insensitive' } },
        { gstin: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { addresses: true },
        skip: params.skip,
        take: params.take,
        orderBy: { legalName: 'asc' },
      }),
      prisma.customer.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { addresses: true },
    });
    if (!customer) throw new AppError('Customer not found.', 404);
    return customer;
  }

  static async createCustomer(input: CreateCustomerInput, meta: AuditMeta) {
    try {
      const created = await prisma.customer.create({
        data: {
          code: input.code,
          legalName: input.legalName,
          tradeName: input.tradeName || null,
          customerType: input.customerType,
          contactName: input.contactName || null,
          email: input.email || null,
          phone: input.phone || null,
          gstin: input.gstin || null,
          pan: input.pan || null,
          creditPeriodDays: input.creditPeriodDays,
          creditLimit: new Prisma.Decimal(input.creditLimit),
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
        entityType: 'Customer',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Customer');
    }
  }

  static async updateCustomer(id: string, input: UpdateCustomerInput, meta: AuditMeta) {
    try {
      const existing = await prisma.customer.findUnique({
        where: { id },
        include: { addresses: true },
      });
      if (!existing) throw new AppError('Customer not found.', 404);

      const updated = await prisma.$transaction(async tx => {
        if (input.addresses !== undefined) {
          await tx.customerAddress.deleteMany({ where: { customerId: id } });
        }

        return tx.customer.update({
          where: { id },
          data: {
            ...(input.code !== undefined && { code: input.code }),
            ...(input.legalName !== undefined && { legalName: input.legalName }),
            ...(input.tradeName !== undefined && { tradeName: input.tradeName || null }),
            ...(input.customerType !== undefined && { customerType: input.customerType }),
            ...(input.contactName !== undefined && { contactName: input.contactName || null }),
            ...(input.email !== undefined && { email: input.email || null }),
            ...(input.phone !== undefined && { phone: input.phone || null }),
            ...(input.gstin !== undefined && { gstin: input.gstin || null }),
            ...(input.pan !== undefined && { pan: input.pan || null }),
            ...(input.creditPeriodDays !== undefined && {
              creditPeriodDays: input.creditPeriodDays,
            }),
            ...(input.creditLimit !== undefined && {
              creditLimit: new Prisma.Decimal(input.creditLimit),
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
        entityType: 'Customer',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Customer');
    }
  }

  static async setCustomerStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing) throw new AppError('Customer not found.', 404);

      const updated = await prisma.customer.update({
        where: { id },
        data: { isActive },
        include: { addresses: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'Customer',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated customer' : 'Deactivated customer',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Customer');
    }
  }
}
