import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { CreateFactoryInput, UpdateFactoryInput } from './admin.types';
import { AdminActorMeta } from './organization.service';

export class FactoryService {
  static async listFactories(params: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FactoryWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { state: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.factory.findMany({
        where,
        include: {
          warehouses: {
            select: {
              id: true,
              code: true,
              name: true,
              warehouseType: true,
              isActive: true,
            },
            orderBy: { code: 'asc' },
          },
        },
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
      prisma.factory.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getFactoryById(id: string) {
    const factory = await prisma.factory.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, legalName: true } },
        warehouses: {
          orderBy: { code: 'asc' },
        },
      },
    });
    if (!factory) {
      throw new AppError('Factory not found.', 404);
    }
    return factory;
  }

  static async createFactory(input: CreateFactoryInput, actor: AdminActorMeta) {
    const company = await prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!company) {
      throw new AppError('Primary organization record not found.', 400);
    }

    const existingCode = await prisma.factory.findUnique({ where: { code: input.code } });
    if (existingCode) {
      throw new AppError(`Factory with code '${input.code}' already exists.`, 409);
    }

    const created = await prisma.$transaction(async tx => {
      const factory = await tx.factory.create({
        data: {
          companyId: company.id,
          code: input.code,
          name: input.name,
          state: input.state,
          stateCode: input.stateCode,
          address: input.address,
          email: input.email || null,
          phone: input.phone || null,
          operationalInfo: input.operationalInfo
            ? (input.operationalInfo as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
        include: { warehouses: true },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'CREATE',
          entityType: 'Factory',
          entityId: factory.id,
          newState: factory as unknown as Prisma.InputJsonValue,
          remarks: `Factory '${factory.code}' created by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });

      return factory;
    });

    return created;
  }

  static async updateFactory(id: string, input: UpdateFactoryInput, actor: AdminActorMeta) {
    const existing = await prisma.factory.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Factory not found.', 404);
    }

    if (input.code && input.code !== existing.code) {
      const dup = await prisma.factory.findUnique({ where: { code: input.code } });
      if (dup) {
        throw new AppError(`Factory with code '${input.code}' already exists.`, 409);
      }
    }

    const data: Prisma.FactoryUpdateInput = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.name !== undefined) data.name = input.name;
    if (input.state !== undefined) data.state = input.state;
    if (input.stateCode !== undefined) data.stateCode = input.stateCode;
    if (input.address !== undefined) data.address = input.address;
    if (input.email !== undefined) data.email = input.email || null;
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.operationalInfo !== undefined) {
      data.operationalInfo = input.operationalInfo
        ? (input.operationalInfo as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    const updated = await prisma.$transaction(async tx => {
      const factory = await tx.factory.update({
        where: { id },
        data,
        include: { warehouses: true },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'UPDATE',
          entityType: 'Factory',
          entityId: factory.id,
          previousState: existing as unknown as Prisma.InputJsonValue,
          newState: factory as unknown as Prisma.InputJsonValue,
          remarks: `Factory '${factory.code}' updated by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });

      return factory;
    });

    return updated;
  }

  static async setFactoryStatus(id: string, isActive: boolean, actor: AdminActorMeta) {
    const existing = await prisma.factory.findUnique({
      where: { id },
      include: { warehouses: { where: { isActive: true } } },
    });
    if (!existing) {
      throw new AppError('Factory not found.', 404);
    }

    if (!isActive && existing.warehouses.length > 0) {
      throw new AppError(
        `Cannot deactivate factory '${existing.code}' while ${existing.warehouses.length} active warehouse(s) are assigned to it.`,
        400,
      );
    }

    const updated = await prisma.$transaction(async tx => {
      const factory = await tx.factory.update({
        where: { id },
        data: { isActive },
        include: { warehouses: true },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'UPDATE',
          entityType: 'Factory',
          entityId: factory.id,
          previousState: { isActive: existing.isActive },
          newState: { isActive: factory.isActive },
          remarks: `Factory '${factory.code}' ${isActive ? 'activated' : 'deactivated'} by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });

      return factory;
    });

    return updated;
  }
}
