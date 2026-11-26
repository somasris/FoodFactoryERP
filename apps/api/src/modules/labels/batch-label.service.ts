import crypto from 'crypto';
import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditService } from '../../services/audit.service';
import { AuditMeta } from '../master-data/master-data.utils';
import { assertWarehouseAccess, getAuthorizedWarehouseIds } from '../inventory/inventory.utils';
import { SyncUserContext } from '../sync/sync.service';
import { AllergenProfile, AllergenService } from '../manufacturing-intelligence/allergen.service';
import { BatchQrService } from '../production/batch-qr.service';
import { AuthoritativeLabelSnapshot, layoutConfigSchema } from './label.types';
import { LabelTemplateService } from './label-template.service';
import { BatchLabelPdfService } from './batch-label-pdf.service';

export class BatchLabelService {
  private static buildAllergenDeclarationText(profile: AllergenProfile): string {
    const parts: string[] = [];
    if (profile.confirmedAllergens.length > 0) {
      parts.push(`Contains: ${profile.confirmedAllergens.join(', ')}`);
    }
    if (profile.crossContactAllergens.length > 0) {
      parts.push(`May contain: ${profile.crossContactAllergens.join(', ')}`);
    }
    if (profile.hasUnknownIngredients) {
      parts.push('Warning: Incomplete allergen declarations');
    }
    if (parts.length === 0) {
      parts.push('No known allergens declared in BOM snapshot');
    }
    return parts.join(' | ');
  }

  private static formatIsoDate(d: Date | null): string | null {
    if (!d) return null;
    return d.toISOString().slice(0, 10);
  }

  private static async generateLabelNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const count = await prisma.batchLabelRecord.count();
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `LBL-${year}-${String(count + 1).padStart(5, '0')}-${rand}`;
  }

  static async buildAuthoritativePreview(
    params: {
      productionBatchId: string;
      templateId: string;
      labelMode: 'RELEASED' | 'INTERNAL_STATUS';
      storageInstructionsOverride?: string;
    },
    user: SyncUserContext,
    meta: AuditMeta,
  ): Promise<{
    snapshot: AuthoritativeLabelSnapshot;
    template: Awaited<ReturnType<typeof LabelTemplateService.getTemplateById>>;
    batch: { id: string; warehouseId: string; factoryId: string };
  }> {
    const template = await LabelTemplateService.getTemplateById(params.templateId);
    if (!template.isActive) {
      throw new AppError('Selected label template is inactive.', 400);
    }

    const batch = await prisma.productionBatch.findUnique({
      where: { id: params.productionBatchId },
      include: {
        product: { select: { id: true, code: true, name: true } },
        productVariant: { select: { id: true, sku: true, name: true, barcode: true } },
        workOrder: { select: { workOrderNumber: true } },
        uom: { select: { symbol: true } },
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
            factoryId: true,
            factory: {
              select: {
                id: true,
                companyId: true,
                name: true,
                address: true,
              },
            },
          },
        },
        qualityInspection: true,
      },
    });

    if (!batch) {
      throw new AppError('Production batch not found.', 404);
    }

    await assertWarehouseAccess(user, batch.warehouseId, 'READ');

    const mfgDate = this.formatIsoDate(batch.manufacturingDate);
    const expDate = this.formatIsoDate(batch.expiryDate);
    if (!mfgDate) {
      throw new AppError('Cannot generate label: manufacturing date is missing on this production batch.', 400);
    }
    if (!expDate) {
      throw new AppError('Cannot generate label: expiry date is missing on this production batch.', 400);
    }

    const qualityDecision = batch.qualityInspection?.decision ?? 'PENDING';
    if (params.labelMode === 'RELEASED') {
      if (qualityDecision !== 'ACCEPTED' && qualityDecision !== 'PARTIALLY_ACCEPTED') {
        throw new AppError(
          `Cannot generate a RELEASED label because quality inspection status is ${qualityDecision}.`,
          409,
        );
      }
    }

    const authoritativeQty =
      params.labelMode === 'RELEASED'
        ? batch.qualityInspection && Number(batch.qualityInspection.goodQuantity) > 0
          ? batch.qualityInspection.goodQuantity
          : batch.actualGoodQuantity
        : Number(batch.actualGoodQuantity) > 0
          ? batch.actualGoodQuantity
          : batch.plannedQuantity;

    if (params.labelMode === 'RELEASED' && Number(authoritativeQty) <= 0) {
      throw new AppError(
        'Cannot generate a RELEASED label: accepted finished-goods quantity must be greater than zero.',
        400,
      );
    }

    const company = batch.warehouse.factory?.companyId
      ? await prisma.company.findUnique({
          where: { id: batch.warehouse.factory.companyId },
          select: { legalName: true, tradeName: true, address: true, fssaiLicense: true },
        })
      : await prisma.company.findFirst({
          where: { isActive: true },
          select: { legalName: true, tradeName: true, address: true, fssaiLicense: true },
        });

    let allergenProfile: AllergenProfile;
    if (batch.allergenSnapshot && typeof batch.allergenSnapshot === 'object') {
      allergenProfile = batch.allergenSnapshot as unknown as AllergenProfile;
    } else {
      allergenProfile = await AllergenService.deriveBomVersionAllergenProfile(batch.bomVersionId);
    }

    let qrReferenceToken: string | null = null;
    let tracePath: string | null = null;
    if (template.includeQr) {
      const qr = await BatchQrService.generateOrGetQr(batch.id, user, meta);
      qrReferenceToken = qr.referenceToken;
      tracePath = qr.tracePath;
    }

    const barcodeValue = template.includeBarcode
      ? batch.productVariant.barcode || `FF-BAT-${batch.batchNumber}`
      : null;

    const factoryId = batch.warehouse.factory?.id ?? batch.warehouse.factoryId;

    const snapshot: AuthoritativeLabelSnapshot = {
      companyName: company?.tradeName || company?.legalName || 'FoodFactory ERP',
      companyAddress: company?.address || batch.warehouse.factory?.address || '',
      fssaiLicense: company?.fssaiLicense ?? null,
      factoryName: batch.warehouse.factory?.name ?? batch.warehouse.name,
      warehouseCode: batch.warehouse.code,
      productName: batch.product.name,
      productCode: batch.product.code,
      variantName: batch.productVariant.name,
      sku: batch.productVariant.sku,
      batchNumber: batch.batchNumber,
      workOrderNumber: batch.workOrder.workOrderNumber,
      manufacturingDate: mfgDate,
      expiryDate: expDate,
      netQuantity: Number(authoritativeQty).toFixed(2),
      uomSymbol: batch.uom.symbol,
      qualityDecision,
      inspectionNumber: batch.qualityInspection?.inspectionNumber ?? null,
      labelMode: params.labelMode,
      allergenSummary: {
        overallStatus: allergenProfile.overallStatus,
        confirmedAllergens: allergenProfile.confirmedAllergens,
        crossContactAllergens: allergenProfile.crossContactAllergens,
        hasUnknownIngredients: allergenProfile.hasUnknownIngredients,
        declarationText: this.buildAllergenDeclarationText(allergenProfile),
      },
      storageInstructions:
        params.storageInstructionsOverride?.trim() ||
        template.defaultStorageInstructions ||
        null,
      qrReferenceToken,
      tracePath,
      barcodeValue,
    };

    return {
      snapshot,
      template,
      batch: {
        id: batch.id,
        warehouseId: batch.warehouseId,
        factoryId,
      },
    };
  }

  static async generateLabel(
    input: {
      productionBatchId: string;
      templateId: string;
      copies: number;
      labelMode: 'RELEASED' | 'INTERNAL_STATUS';
      storageInstructionsOverride?: string;
      idempotencyKey?: string;
    },
    user: SyncUserContext,
    meta: AuditMeta,
  ) {
    if (input.idempotencyKey) {
      const existing = await prisma.batchLabelRecord.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        await assertWarehouseAccess(user, existing.warehouseId, 'READ');
        return existing;
      }
    }

    const { snapshot, template, batch } = await this.buildAuthoritativePreview(input, user, meta);
    await assertWarehouseAccess(user, batch.warehouseId, 'READ_WRITE');

    const labelNumber = await this.generateLabelNumber();

    const record = await prisma.batchLabelRecord.create({
      data: {
        labelNumber,
        productionBatchId: batch.id,
        factoryId: batch.factoryId,
        warehouseId: batch.warehouseId,
        templateId: template.id,
        templateVersionNumber: template.versionNumber,
        generationType: 'ORIGINAL',
        copies: input.copies,
        qualityStatusSnapshot: snapshot.qualityDecision,
        qrReferenceToken: snapshot.qrReferenceToken,
        barcodeValue: snapshot.barcodeValue,
        labelSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        generatedById: user.userId,
        idempotencyKey: input.idempotencyKey ?? null,
      },
      include: {
        template: { select: { code: true, name: true, widthMm: true, heightMm: true } },
      },
    });

    await AuditService.log({
      userId: user.userId,
      action: AuditAction.CREATE,
      entityType: 'BatchLabelRecord',
      entityId: record.id,
      newState: {
        labelNumber: record.labelNumber,
        productionBatchId: batch.id,
        templateId: template.id,
        templateVersionNumber: template.versionNumber,
        copies: input.copies,
        generationType: 'ORIGINAL',
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Generated ${input.copies} batch label(s) for ${snapshot.batchNumber}`,
    });

    return record;
  }

  static async reprintLabel(
    labelId: string,
    input: { copies: number; idempotencyKey?: string },
    user: SyncUserContext,
    meta: AuditMeta,
  ) {
    if (input.idempotencyKey) {
      const existing = await prisma.batchLabelRecord.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        await assertWarehouseAccess(user, existing.warehouseId, 'READ');
        return existing;
      }
    }

    const source = await prisma.batchLabelRecord.findUnique({
      where: { id: labelId },
    });
    if (!source) {
      throw new AppError('Label record not found.', 404);
    }

    await assertWarehouseAccess(user, source.warehouseId, 'READ_WRITE');

    const labelNumber = await this.generateLabelNumber();

    const reprint = await prisma.batchLabelRecord.create({
      data: {
        labelNumber,
        productionBatchId: source.productionBatchId,
        factoryId: source.factoryId,
        warehouseId: source.warehouseId,
        templateId: source.templateId,
        templateVersionNumber: source.templateVersionNumber,
        generationType: 'REPRINT',
        parentLabelId: source.id,
        copies: input.copies,
        qualityStatusSnapshot: source.qualityStatusSnapshot,
        qrReferenceToken: source.qrReferenceToken,
        barcodeValue: source.barcodeValue,
        labelSnapshot: source.labelSnapshot as Prisma.InputJsonValue,
        generatedById: user.userId,
        idempotencyKey: input.idempotencyKey ?? null,
      },
      include: {
        template: { select: { code: true, name: true, widthMm: true, heightMm: true } },
      },
    });

    await AuditService.log({
      userId: user.userId,
      action: AuditAction.CREATE,
      entityType: 'BatchLabelRecord',
      entityId: reprint.id,
      newState: {
        labelNumber: reprint.labelNumber,
        parentLabelId: source.id,
        copies: input.copies,
        generationType: 'REPRINT',
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      remarks: `Reprinted ${input.copies} copy/copies from ${source.labelNumber}`,
    });

    return reprint;
  }

  static async listHistory(
    filters: { productionBatchId?: string; generationType?: string },
    user: SyncUserContext,
  ) {
    const authWhIds = await getAuthorizedWarehouseIds(user, 'READ');

    return prisma.batchLabelRecord.findMany({
      where: {
        ...(filters.productionBatchId ? { productionBatchId: filters.productionBatchId } : {}),
        ...(filters.generationType === 'ORIGINAL' || filters.generationType === 'REPRINT'
          ? { generationType: filters.generationType }
          : {}),
        ...(authWhIds ? { warehouseId: { in: authWhIds } } : {}),
      },
      include: {
        template: { select: { id: true, code: true, name: true, widthMm: true, heightMm: true } },
      },
      orderBy: { generatedAt: 'desc' },
      take: 100,
    });
  }

  static async renderRecordPdf(labelId: string, user: SyncUserContext, qrBaseUrl: string) {
    const record = await prisma.batchLabelRecord.findUnique({
      where: { id: labelId },
      include: { template: true },
    });
    if (!record) {
      throw new AppError('Label record not found.', 404);
    }

    await assertWarehouseAccess(user, record.warehouseId, 'READ');

    const snapshot = record.labelSnapshot as unknown as AuthoritativeLabelSnapshot;
    const layoutConfig = layoutConfigSchema.parse(record.template.layoutConfig);

    const buffer = await BatchLabelPdfService.renderLabelPdf({
      labelNumber: record.labelNumber,
      generationType: record.generationType,
      widthMm: Number(record.template.widthMm),
      heightMm: Number(record.template.heightMm),
      includeQr: record.template.includeQr,
      includeBarcode: record.template.includeBarcode,
      copies: record.copies,
      layoutConfig,
      snapshot,
      qrBaseUrl,
    });

    return { buffer, labelNumber: record.labelNumber };
  }
}
