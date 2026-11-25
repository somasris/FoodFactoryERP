import { Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { UpdateOrganizationInput } from './admin.types';

export interface AdminActorMeta {
  userId: string;
  username: string;
  roles: string[];
  ipAddress?: string;
  userAgent?: string;
}

export class OrganizationService {
  /**
   * Retrieve the primary active organization (single-company ERP profile).
   */
  static async getOrganization() {
    const company = await prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            factories: true,
            users: true,
          },
        },
      },
    });

    if (!company) {
      throw new AppError('Primary organization record not found.', 404);
    }

    return company;
  }

  /**
   * Update organization profile, tax registration, and business preferences.
   */
  static async updateOrganization(input: UpdateOrganizationInput, actor: AdminActorMeta) {
    const existing = await prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!existing) {
      throw new AppError('Primary organization record not found.', 404);
    }

    const data: Prisma.CompanyUpdateInput = {};
    if (input.legalName !== undefined) data.legalName = input.legalName;
    if (input.tradeName !== undefined) data.tradeName = input.tradeName;
    if (input.gstin !== undefined) data.gstin = input.gstin;
    if (input.pan !== undefined) data.pan = input.pan;
    if (input.state !== undefined) data.state = input.state;
    if (input.stateCode !== undefined) data.stateCode = input.stateCode;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.address !== undefined) data.address = input.address;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl || null;
    if (input.registrationNumber !== undefined) {
      data.registrationNumber = input.registrationNumber;
    }
    if (input.fssaiLicense !== undefined) data.fssaiLicense = input.fssaiLicense;
    if (input.financialYearStartMonth !== undefined) {
      data.financialYearStartMonth = input.financialYearStartMonth;
    }
    if (input.defaultCurrency !== undefined) data.defaultCurrency = input.defaultCurrency;
    if (input.defaultTimezone !== undefined) data.defaultTimezone = input.defaultTimezone;
    if (input.preferences !== undefined) {
      data.preferences = input.preferences
        ? (input.preferences as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    const updated = await prisma.$transaction(async tx => {
      const saved = await tx.company.update({
        where: { id: existing.id },
        data,
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'UPDATE',
          entityType: 'Company',
          entityId: existing.id,
          previousState: existing as unknown as Prisma.InputJsonValue,
          newState: saved as unknown as Prisma.InputJsonValue,
          remarks: `Organization profile updated by ${actor.username}`,
          ipAddress: actor.ipAddress || null,
          userAgent: actor.userAgent || null,
        },
      });

      return saved;
    });

    return updated;
  }

  /**
   * Retrieve organization configuration change history from AuditLog.
   */
  static async getOrganizationHistory(page = 1, limit = 20) {
    const company = await this.getOrganization();
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          entityType: 'Company',
          entityId: company.id,
        },
        include: {
          user: {
            select: { id: true, username: true, fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({
        where: {
          entityType: 'Company',
          entityId: company.id,
        },
      }),
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
}
