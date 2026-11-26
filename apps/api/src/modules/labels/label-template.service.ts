import { AuditAction, LabelSizePreset, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditService } from '../../services/audit.service';
import { AuditMeta } from '../master-data/master-data.utils';
import {
  createLabelTemplateSchema,
  LABEL_SIZE_PRESETS,
  layoutConfigSchema,
  updateLabelTemplateSchema,
} from './label.types';
import { z } from 'zod';

const DEFAULT_TEMPLATES: Array<{
  code: string;
  name: string;
  description: string;
  sizePreset: LabelSizePreset;
  widthMm: number;
  heightMm: number;
  isDefault: boolean;
  defaultStorageInstructions: string;
}> = [
  {
    code: 'LBL-SMALL-50X30',
    name: 'Small Product Label (50x30 mm)',
    description: 'Compact unit label with product, SKU, batch, expiry, and traceable QR.',
    sizePreset: 'SMALL_PRODUCT',
    widthMm: LABEL_SIZE_PRESETS.SMALL_PRODUCT.widthMm,
    heightMm: LABEL_SIZE_PRESETS.SMALL_PRODUCT.heightMm,
    isDefault: false,
    defaultStorageInstructions: 'Store in a cool, dry place away from direct sunlight.',
  },
  {
    code: 'LBL-STD-100X70',
    name: 'Standard Batch Label (100x70 mm)',
    description: 'Standard food-manufacturing batch label with allergen declaration, QC status, and QR traceability.',
    sizePreset: 'STANDARD_BATCH',
    widthMm: LABEL_SIZE_PRESETS.STANDARD_BATCH.widthMm,
    heightMm: LABEL_SIZE_PRESETS.STANDARD_BATCH.heightMm,
    isDefault: true,
    defaultStorageInstructions: 'Store in a cool, dry place. Keep sealed after opening.',
  },
  {
    code: 'LBL-CARTON-148X105',
    name: 'Large Carton / Case Label (148x105 mm)',
    description: 'A6 carton & outer packaging label with full company, factory, allergen, and traceability details.',
    sizePreset: 'LARGE_CARTON',
    widthMm: LABEL_SIZE_PRESETS.LARGE_CARTON.widthMm,
    heightMm: LABEL_SIZE_PRESETS.LARGE_CARTON.heightMm,
    isDefault: false,
    defaultStorageInstructions: 'Keep dry. Stack max 5 cartons high.',
  },
];

export class LabelTemplateService {
  static async ensureDefaultTemplates(actorId: string) {
    const existingCount = await prisma.batchLabelTemplate.count();
    if (existingCount > 0) return;

    const defaultLayout = layoutConfigSchema.parse({});
    for (const tpl of DEFAULT_TEMPLATES) {
      await prisma.batchLabelTemplate.create({
        data: {
          code: tpl.code,
          name: tpl.name,
          description: tpl.description,
          sizePreset: tpl.sizePreset,
          widthMm: new Prisma.Decimal(tpl.widthMm),
          heightMm: new Prisma.Decimal(tpl.heightMm),
          logoPlacement: 'TOP_LEFT',
          includeQr: true,
          includeBarcode: true,
          layoutConfig: defaultLayout as Prisma.InputJsonValue,
          defaultStorageInstructions: tpl.defaultStorageInstructions,
          versionNumber: 1,
          isActive: true,
          isDefault: tpl.isDefault,
          createdById: actorId,
          versions: {
            create: {
              versionNumber: 1,
              sizePreset: tpl.sizePreset,
              widthMm: new Prisma.Decimal(tpl.widthMm),
              heightMm: new Prisma.Decimal(tpl.heightMm),
              logoPlacement: 'TOP_LEFT',
              includeQr: true,
              includeBarcode: true,
              layoutConfig: defaultLayout as Prisma.InputJsonValue,
              defaultStorageInstructions: tpl.defaultStorageInstructions,
              createdById: actorId,
            },
          },
        },
      });
    }
  }

  static async listTemplates(actorId: string, includeInactive = false) {
    await this.ensureDefaultTemplates(actorId);
    return prisma.batchLabelTemplate.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 5 },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  static async getTemplateById(id: string) {
    const tpl = await prisma.batchLabelTemplate.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });
    if (!tpl) {
      throw new AppError('Label template not found.', 404);
    }
    return tpl;
  }

  static async createTemplate(
    input: z.infer<typeof createLabelTemplateSchema>,
    actorId: string,
    meta: AuditMeta,
  ) {
    const existing = await prisma.batchLabelTemplate.findUnique({
      where: { code: input.code },
    });
    if (existing) {
      throw new AppError(`Template code "${input.code}" already exists.`, 409);
    }

    const created = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.batchLabelTemplate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const tpl = await tx.batchLabelTemplate.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          sizePreset: input.sizePreset,
          widthMm: new Prisma.Decimal(input.widthMm),
          heightMm: new Prisma.Decimal(input.heightMm),
          logoPlacement: input.logoPlacement,
          includeQr: input.includeQr,
          includeBarcode: input.includeBarcode,
          layoutConfig: input.layoutConfig as Prisma.InputJsonValue,
          defaultStorageInstructions: input.defaultStorageInstructions ?? null,
          versionNumber: 1,
          isActive: true,
          isDefault: input.isDefault ?? false,
          createdById: actorId,
          versions: {
            create: {
              versionNumber: 1,
              sizePreset: input.sizePreset,
              widthMm: new Prisma.Decimal(input.widthMm),
              heightMm: new Prisma.Decimal(input.heightMm),
              logoPlacement: input.logoPlacement,
              includeQr: input.includeQr,
              includeBarcode: input.includeBarcode,
              layoutConfig: input.layoutConfig as Prisma.InputJsonValue,
              defaultStorageInstructions: input.defaultStorageInstructions ?? null,
              createdById: actorId,
            },
          },
        },
        include: { versions: true },
      });

      await AuditService.log({
        userId: actorId,
        action: AuditAction.CREATE,
        entityType: 'BatchLabelTemplate',
        entityId: tpl.id,
        newState: { code: tpl.code, name: tpl.name, versionNumber: 1 },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return tpl;
    });

    return created;
  }

  static async updateTemplate(
    id: string,
    input: z.infer<typeof updateLabelTemplateSchema>,
    actorId: string,
    meta: AuditMeta,
  ) {
    const current = await prisma.batchLabelTemplate.findUnique({ where: { id } });
    if (!current) {
      throw new AppError('Label template not found.', 404);
    }

    const nextVersion = current.versionNumber + 1;
    const nextSizePreset = input.sizePreset ?? current.sizePreset;
    const nextWidth = input.widthMm !== undefined ? new Prisma.Decimal(input.widthMm) : current.widthMm;
    const nextHeight = input.heightMm !== undefined ? new Prisma.Decimal(input.heightMm) : current.heightMm;
    const nextLogo = input.logoPlacement ?? current.logoPlacement;
    const nextIncludeQr = input.includeQr ?? current.includeQr;
    const nextIncludeBarcode = input.includeBarcode ?? current.includeBarcode;
    const nextLayout = (input.layoutConfig ?? current.layoutConfig) as Prisma.InputJsonValue;
    const nextStorage =
      input.defaultStorageInstructions !== undefined
        ? input.defaultStorageInstructions
        : current.defaultStorageInstructions;

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.batchLabelTemplate.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const tpl = await tx.batchLabelTemplate.update({
        where: { id },
        data: {
          name: input.name ?? current.name,
          description: input.description !== undefined ? input.description : current.description,
          sizePreset: nextSizePreset,
          widthMm: nextWidth,
          heightMm: nextHeight,
          logoPlacement: nextLogo,
          includeQr: nextIncludeQr,
          includeBarcode: nextIncludeBarcode,
          layoutConfig: nextLayout,
          defaultStorageInstructions: nextStorage,
          isDefault: input.isDefault ?? current.isDefault,
          versionNumber: nextVersion,
          updatedById: actorId,
          versions: {
            create: {
              versionNumber: nextVersion,
              sizePreset: nextSizePreset,
              widthMm: nextWidth,
              heightMm: nextHeight,
              logoPlacement: nextLogo,
              includeQr: nextIncludeQr,
              includeBarcode: nextIncludeBarcode,
              layoutConfig: nextLayout,
              defaultStorageInstructions: nextStorage,
              createdById: actorId,
            },
          },
        },
        include: { versions: { orderBy: { versionNumber: 'desc' } } },
      });

      await AuditService.log({
        userId: actorId,
        action: AuditAction.UPDATE,
        entityType: 'BatchLabelTemplate',
        entityId: tpl.id,
        previousState: { versionNumber: current.versionNumber, name: current.name },
        newState: { versionNumber: nextVersion, name: tpl.name },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return tpl;
    });

    return updated;
  }

  static async duplicateTemplate(id: string, actorId: string, meta: AuditMeta) {
    const source = await this.getTemplateById(id);
    const suffix = Date.now().toString().slice(-4);
    const copyCode = `${source.code.slice(0, 30)}-C${suffix}`;

    return this.createTemplate(
      {
        code: copyCode,
        name: `${source.name} (Copy)`,
        description: source.description ?? undefined,
        sizePreset: source.sizePreset,
        widthMm: Number(source.widthMm),
        heightMm: Number(source.heightMm),
        logoPlacement: source.logoPlacement as 'TOP_LEFT' | 'TOP_RIGHT' | 'TOP_CENTER' | 'NONE',
        includeQr: source.includeQr,
        includeBarcode: source.includeBarcode,
        layoutConfig: layoutConfigSchema.parse(source.layoutConfig),
        defaultStorageInstructions: source.defaultStorageInstructions ?? undefined,
        isDefault: false,
      },
      actorId,
      meta,
    );
  }

  static async setTemplateActive(id: string, isActive: boolean, actorId: string, meta: AuditMeta) {
    const current = await this.getTemplateById(id);
    if (!isActive && current.isDefault) {
      throw new AppError('Cannot deactivate the default label template. Set another template as default first.', 400);
    }

    const updated = await prisma.batchLabelTemplate.update({
      where: { id },
      data: { isActive, updatedById: actorId },
    });

    await AuditService.log({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'BatchLabelTemplate',
      entityId: id,
      previousState: { isActive: current.isActive },
      newState: { isActive },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
