import { Prisma, WarehouseType } from '@prisma/client';
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
import { CreateWarehouseInput, UpdateWarehouseInput } from './warehouses.types';

export class WarehousesService {
  static async listFactories() {
    return prisma.factory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async listWarehouses(
    params: PaginationParams,
    actor: { userId: string; roles: string[] },
    warehouseType?: string,
  ) {
    const isGlobal = actor.roles.includes('OWNER') || actor.roles.includes('ADMIN');

    const where: Prisma.WarehouseWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (warehouseType) where.warehouseType = warehouseType as WarehouseType;
    if (!isGlobal) {
      where.userAccess = { some: { userId: actor.userId } };
    }
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        include: { factory: true },
        skip: params.skip,
        take: params.take,
        orderBy: { code: 'asc' },
      }),
      prisma.warehouse.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getWarehouseById(id: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: { factory: true },
    });
    if (!warehouse) throw new AppError('Warehouse not found.', 404);
    return warehouse;
  }

  static async createWarehouse(input: CreateWarehouseInput, meta: AuditMeta) {
    try {
      const factory = await prisma.factory.findUnique({ where: { id: input.factoryId } });
      if (!factory) throw new AppError('Referenced factory not found.', 400);
      if (!factory.isActive) throw new AppError('Referenced factory is inactive.', 400);

      const created = await prisma.warehouse.create({
        data: {
          factoryId: input.factoryId,
          code: input.code,
          name: input.name,
          warehouseType: input.warehouseType,
          address: input.address ?? null,
        },
        include: { factory: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'Warehouse',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Warehouse');
    }
  }

  static async updateWarehouse(id: string, input: UpdateWarehouseInput, meta: AuditMeta) {
    try {
      const existing = await prisma.warehouse.findUnique({ where: { id } });
      if (!existing) throw new AppError('Warehouse not found.', 404);

      if (input.factoryId) {
        const factory = await prisma.factory.findUnique({ where: { id: input.factoryId } });
        if (!factory) throw new AppError('Referenced factory not found.', 400);
        if (!factory.isActive) throw new AppError('Referenced factory is inactive.', 400);
      }

      const updated = await prisma.warehouse.update({
        where: { id },
        data: input,
        include: { factory: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'Warehouse',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Warehouse');
    }
  }

  static async setWarehouseStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.warehouse.findUnique({ where: { id } });
      if (!existing) throw new AppError('Warehouse not found.', 404);

      const updated = await prisma.warehouse.update({
        where: { id },
        data: { isActive },
        include: { factory: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'Warehouse',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated warehouse' : 'Deactivated warehouse',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Warehouse');
    }
  }
}
