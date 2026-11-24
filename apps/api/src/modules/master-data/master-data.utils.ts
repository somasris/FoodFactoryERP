import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
  search?: string;
  isActive?: boolean;
}

export interface AuditMeta {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const parsePagination = (query: Record<string, unknown>): PaginationParams => {
  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? 20);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(Math.floor(rawLimit), 100) : 20;

  const search = typeof query.search === 'string' && query.search.trim() ? query.search.trim() : undefined;

  let isActive: boolean | undefined;
  if (query.isActive === 'true' || query.isActive === true) {
    isActive = true;
  } else if (query.isActive === 'false' || query.isActive === false) {
    isActive = false;
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    search,
    isActive,
  };
};

export const paginatedResult = <T>(items: T[], total: number, page: number, limit: number) => ({
  items,
  pagination: {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  },
});

export const getAuditMeta = (req: Request): AuditMeta => ({
  userId: req.user?.userId,
  ipAddress: req.ip || req.socket.remoteAddress || undefined,
  userAgent: req.headers['user-agent'] || undefined,
});

export const handlePrismaError = (error: unknown, entityName: string): never => {
  if (error instanceof AppError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(', ')
        : String(error.meta?.target || 'identifier');
      throw new AppError(`${entityName} with duplicate ${target} already exists.`, 409, {
        code: 'DUPLICATE_RECORD',
        target,
      });
    }
    if (error.code === 'P2003') {
      throw new AppError(`Invalid foreign key reference for ${entityName}.`, 400, {
        code: 'INVALID_REFERENCE',
      });
    }
    if (error.code === 'P2025') {
      throw new AppError(`${entityName} not found.`, 404);
    }
  }

  throw error;
};

export const toPlainJson = <T>(data: T): Record<string, unknown> => {
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
};
