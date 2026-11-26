import { NotificationCategory, NotificationPriority, NotificationType, Prisma, SubstitutionCompatibility } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { AuditService } from '../../services/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { toPlainJson } from '../master-data/master-data.utils';
import {
  assertWarehouseAccess,
  convertQuantityDecimal,
  getAuthorizedWarehouseIds,
  isBatchExpired,
  UserContext,
  ZERO,
} from '../inventory/inventory.utils';
import {
  CreateSubstitutionRequestInput,
  EvaluateSubstitutionInput,
} from './collaboration.types';

export interface SubstitutionEvaluationResult {
  compatibilityStatus: SubstitutionCompatibility;
  reasons: Array<{
    code: string;
    severity: 'BLOCKER' | 'WARNING' | 'INFO';
    message: string;
  }>;
  allergenComparison: {
    originalStatus: string;
    originalAllergens: string[];
    substituteStatus: string;
    substituteAllergens: string[];
    substituteCrossContact: string[];
    introducesNewAllergens: boolean;
    hasUnknownAllergenInfo: boolean;
  };
  inventorySummary: {
    requiredInSubstituteUom: string;
    substituteUomSymbol: string;
    availableAcceptedQty: string;
    reservedQty: string;
    quarantinedQty: string;
    rejectedQty: string;
    expiredQty: string;
  };
}

export class MaterialSubstitutionService {
  /**
   * Read-only compatibility evaluation. Never modifies BOM, stock, or batches.
   */
  static async evaluate(
    user: UserContext,
    input: EvaluateSubstitutionInput,
  ): Promise<SubstitutionEvaluationResult> {
    await assertWarehouseAccess(user, input.warehouseId, 'READ');

    if (input.originalItemId === input.substituteItemId) {
      throw new AppError('Original and substitute material cannot be the same item.', 400);
    }

    const [bomVersion, originalItem, substituteItem] = await Promise.all([
      prisma.bOMVersion.findUnique({
        where: { id: input.bomVersionId },
        include: { bom: true, items: true },
      }),
      prisma.inventoryItem.findUnique({
        where: { id: input.originalItemId },
        include: { rawMaterial: true, uom: true },
      }),
      prisma.inventoryItem.findUnique({
        where: { id: input.substituteItemId },
        include: { rawMaterial: true, uom: true },
      }),
    ]);

    if (!bomVersion || bomVersion.bomId !== input.bomId) {
      throw new AppError('BOM version not found for the selected BOM.', 404);
    }
    if (!originalItem || !substituteItem) {
      throw new AppError('Original or substitute inventory item not found.', 404);
    }

    const reasons: SubstitutionEvaluationResult['reasons'] = [];
    let hasBlocker = false;
    let requiresReview = false;

    // 1. Check item type & raw material category
    if (originalItem.itemType !== substituteItem.itemType) {
      hasBlocker = true;
      reasons.push({
        code: 'ITEM_TYPE_MISMATCH',
        severity: 'BLOCKER',
        message: `Item type mismatch (${originalItem.itemType} vs ${substituteItem.itemType}).`,
      });
    }
    if (
      originalItem.rawMaterial &&
      substituteItem.rawMaterial &&
      originalItem.rawMaterial.categoryId !== substituteItem.rawMaterial.categoryId
    ) {
      requiresReview = true;
      reasons.push({
        code: 'CATEGORY_MISMATCH',
        severity: 'WARNING',
        message: 'Substitute belongs to a different raw material category.',
      });
    }

    // 2. UOM conversion check
    let requiredInSubUom = ZERO;
    try {
      const conv = await convertQuantityDecimal(
        prisma,
        new Prisma.Decimal(input.requiredQuantity),
        input.uomId,
        substituteItem.uomId,
      );
      requiredInSubUom = conv.converted;
    } catch {
      hasBlocker = true;
      reasons.push({
        code: 'UOM_CONVERSION_UNAVAILABLE',
        severity: 'BLOCKER',
        message: `UOM conversion is unavailable between requested UOM and ${substituteItem.uom.code}.`,
      });
    }

    // 3. Warehouse inventory availability, expiry, and quality status
    const balances = await prisma.inventoryBalance.findMany({
      where: {
        warehouseId: input.warehouseId,
        inventoryItemId: substituteItem.id,
        quantityOnHand: { gt: ZERO },
      },
      include: { batch: true },
    });

    let availableAccepted = ZERO;
    let reservedTotal = ZERO;
    let quarantinedTotal = ZERO;
    let rejectedTotal = ZERO;
    let expiredTotal = ZERO;

    for (const bal of balances) {
      const onHand = new Prisma.Decimal(bal.quantityOnHand);
      const reserved = new Prisma.Decimal(bal.quantityReserved);
      reservedTotal = reservedTotal.add(reserved);

      const qStatus = bal.batch?.qualityStatus ?? 'ACCEPTED';
      const expired = bal.batch?.expiryDate ? isBatchExpired(bal.batch.expiryDate) : false;

      if (qStatus === 'QUARANTINED') {
        quarantinedTotal = quarantinedTotal.add(onHand);
      } else if (qStatus === 'REJECTED') {
        rejectedTotal = rejectedTotal.add(onHand);
      } else if (expired) {
        expiredTotal = expiredTotal.add(onHand);
      } else if (qStatus === 'ACCEPTED') {
        const free = onHand.sub(reserved);
        if (free.gt(ZERO)) availableAccepted = availableAccepted.add(free);
      }
    }

    if (balances.length > 0 && availableAccepted.lte(ZERO)) {
      if (expiredTotal.gt(ZERO)) {
        hasBlocker = true;
        reasons.push({
          code: 'SUBSTITUTE_EXPIRED',
          severity: 'BLOCKER',
          message: 'Substitute material stock in this warehouse is expired.',
        });
      }
      if (quarantinedTotal.gt(ZERO) || rejectedTotal.gt(ZERO)) {
        hasBlocker = true;
        reasons.push({
          code: 'SUBSTITUTE_QUARANTINED_OR_REJECTED',
          severity: 'BLOCKER',
          message: 'Substitute material is quarantined or rejected.',
        });
      }
    }

    if (!hasBlocker && requiredInSubUom.gt(ZERO) && availableAccepted.lt(requiredInSubUom)) {
      hasBlocker = true;
      reasons.push({
        code: 'INSUFFICIENT_AVAILABLE_STOCK',
        severity: 'BLOCKER',
        message: `Required quantity (${requiredInSubUom.toFixed(4)} ${substituteItem.uom.symbol}) exceeds available accepted stock (${availableAccepted.toFixed(4)} ${substituteItem.uom.symbol}).`,
      });
    }

    // 4. Allergen profile comparison
    const origRm = originalItem.rawMaterial;
    const subRm = substituteItem.rawMaterial;
    const origStatus = origRm?.allergenStatus ?? 'UNKNOWN';
    const subStatus = subRm?.allergenStatus ?? 'UNKNOWN';
    const origAllergens = origRm?.allergens ?? [];
    const subAllergens = subRm?.allergens ?? [];
    const subCross = subRm?.crossContactAllergens ?? [];

    const newAllergens = subAllergens.filter(a => !origAllergens.includes(a));
    const introducesNewAllergens = newAllergens.length > 0;
    const hasUnknownAllergenInfo = subStatus === 'UNKNOWN';

    if (hasUnknownAllergenInfo) {
      requiresReview = true;
      reasons.push({
        code: 'UNKNOWN_ALLERGEN_INFO',
        severity: 'WARNING',
        message: 'Substitute has unknown allergen information; cannot verify allergen safety.',
      });
    }

    if (introducesNewAllergens || subCross.length > 0) {
      requiresReview = true;
      reasons.push({
        code: 'ALLERGEN_PROFILE_DIFFERS',
        severity: 'WARNING',
        message: `Allergen profile differs from original ingredient (introduces: ${newAllergens.join(', ') || 'cross-contact risk'}).`,
      });
    }

    // 5. Explicit approved-substitute relationship check
    // Schema does not store pre-approved substitute pairs, so technical review is required
    requiresReview = true;
    reasons.push({
      code: 'NO_APPROVED_SUBSTITUTE_RELATION',
      severity: 'INFO',
      message: 'No pre-approved substitute relationship exists in master data; requires authorized review.',
    });

    const compatibilityStatus: SubstitutionCompatibility = hasBlocker
      ? 'NOT_COMPATIBLE'
      : requiresReview
        ? 'REQUIRES_REVIEW'
        : 'COMPATIBLE';

    return {
      compatibilityStatus,
      reasons,
      allergenComparison: {
        originalStatus: origStatus,
        originalAllergens: origAllergens,
        substituteStatus: subStatus,
        substituteAllergens: subAllergens,
        substituteCrossContact: subCross,
        introducesNewAllergens,
        hasUnknownAllergenInfo,
      },
      inventorySummary: {
        requiredInSubstituteUom: requiredInSubUom.toFixed(4),
        substituteUomSymbol: substituteItem.uom.symbol,
        availableAcceptedQty: availableAccepted.toFixed(4),
        reservedQty: reservedTotal.toFixed(4),
        quarantinedQty: quarantinedTotal.toFixed(4),
        rejectedQty: rejectedTotal.toFixed(4),
        expiredQty: expiredTotal.toFixed(4),
      },
    };
  }

  static async listRequests(user: UserContext) {
    const allowedWh = await getAuthorizedWarehouseIds(user, 'READ');
    return prisma.materialSubstitutionRequest.findMany({
      where: allowedWh ? { warehouseId: { in: allowedWh } } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  static async createRequest(
    user: UserContext,
    input: CreateSubstitutionRequestInput,
    meta: { userId: string; ipAddress?: string; userAgent?: string },
  ) {
    await assertWarehouseAccess(user, input.warehouseId, 'READ_WRITE');
    const evaluation = await this.evaluate(user, input);
    const warehouse = await prisma.warehouse.findUniqueOrThrow({
      where: { id: input.warehouseId },
      select: { factoryId: true },
    });

    const requestNumber = `SUB-${Date.now().toString().slice(-7)}`;
    const created = await prisma.materialSubstitutionRequest.create({
      data: {
        requestNumber,
        factoryId: warehouse.factoryId,
        warehouseId: input.warehouseId,
        bomId: input.bomId,
        bomVersionId: input.bomVersionId,
        productionBatchId: input.productionBatchId ?? null,
        workOrderId: input.workOrderId ?? null,
        originalItemId: input.originalItemId,
        substituteItemId: input.substituteItemId,
        requiredQuantity: new Prisma.Decimal(input.requiredQuantity),
        uomId: input.uomId,
        compatibilityStatus: evaluation.compatibilityStatus,
        evaluationReasons: toPlainJson(evaluation.reasons) as Prisma.InputJsonValue,
        allergenComparison: toPlainJson(evaluation.allergenComparison) as Prisma.InputJsonValue,
        status: 'PENDING_APPROVAL',
        reason: input.reason,
        requestedById: user.userId,
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'CREATE',
      entityType: 'MaterialSubstitutionRequest',
      entityId: created.id,
      newState: toPlainJson(created),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notifySafe({
      title: `Material Substitution Request: ${created.requestNumber}`,
      message: `Substitution request (${evaluation.compatibilityStatus}) awaits authorized review.`,
      type: NotificationType.ACTION_REQUIRED,
      category: NotificationCategory.PRODUCTION,
      priority: NotificationPriority.HIGH,
      eventKey: `substitution.requested:${created.id}`,
      entityType: 'MaterialSubstitutionRequest',
      entityId: created.id,
      actionUrl: '/production/substitutions',
      target: {
        permissions: ['production.work_orders.approve'],
        warehouseId: created.warehouseId,
      },
    });

    return created;
  }

  static async approveRequest(
    user: UserContext,
    id: string,
    notes: string | null | undefined,
    meta: { userId: string; ipAddress?: string; userAgent?: string },
  ) {
    const updated = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM material_substitution_requests WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Substitution request not found.', 404);

      const reqRecord = await tx.materialSubstitutionRequest.findUniqueOrThrow({ where: { id } });
      await assertWarehouseAccess(user, reqRecord.warehouseId, 'READ_WRITE');

      if (reqRecord.status !== 'PENDING_APPROVAL') {
        throw new AppError(
          `Substitution request cannot be approved in status ${reqRecord.status}.`,
          400,
        );
      }

      return tx.materialSubstitutionRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: user.userId,
          approvedAt: new Date(),
          approvalNotes: notes ?? null,
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'APPROVE',
      entityType: 'MaterialSubstitutionRequest',
      entityId: updated.id,
      newState: toPlainJson(updated),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  static async rejectRequest(
    user: UserContext,
    id: string,
    reason: string,
    meta: { userId: string; ipAddress?: string; userAgent?: string },
  ) {
    const updated = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM material_substitution_requests WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Substitution request not found.', 404);

      const reqRecord = await tx.materialSubstitutionRequest.findUniqueOrThrow({ where: { id } });
      await assertWarehouseAccess(user, reqRecord.warehouseId, 'READ_WRITE');

      if (reqRecord.status !== 'PENDING_APPROVAL') {
        throw new AppError(
          `Substitution request cannot be rejected in status ${reqRecord.status}.`,
          400,
        );
      }

      return tx.materialSubstitutionRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedById: user.userId,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
      });
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'REJECT',
      entityType: 'MaterialSubstitutionRequest',
      entityId: updated.id,
      remarks: reason,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  /**
   * Revalidates live availability & quality before marking APPROVED substitution as APPLIED.
   * Preserves original BOM; actual consumption still flows through ProductionBatchService.
   */
  static async applyRequest(
    user: UserContext,
    id: string,
    notes: string | null | undefined,
    meta: { userId: string; ipAddress?: string; userAgent?: string },
  ) {
    const existing = await prisma.materialSubstitutionRequest.findUnique({ where: { id } });
    if (!existing) throw new AppError('Substitution request not found.', 404);
    await assertWarehouseAccess(user, existing.warehouseId, 'READ_WRITE');

    if (existing.status !== 'APPROVED') {
      throw new AppError(
        `Only APPROVED substitution requests can be applied (current: ${existing.status}).`,
        400,
      );
    }

    // Revalidate live stock availability & quality before application
    const recheck = await this.evaluate(user, {
      warehouseId: existing.warehouseId,
      bomId: existing.bomId,
      bomVersionId: existing.bomVersionId,
      originalItemId: existing.originalItemId,
      substituteItemId: existing.substituteItemId,
      requiredQuantity: existing.requiredQuantity.toString(),
      uomId: existing.uomId,
      productionBatchId: existing.productionBatchId,
      workOrderId: existing.workOrderId,
    });

    if (recheck.compatibilityStatus === 'NOT_COMPATIBLE') {
      throw new AppError(
        `Revalidation failed before application: ${recheck.reasons
          .filter(r => r.severity === 'BLOCKER')
          .map(r => r.message)
          .join(' ')}`,
        409,
      );
    }

    const updated = await prisma.materialSubstitutionRequest.update({
      where: { id },
      data: {
        status: 'APPLIED',
        appliedById: user.userId,
        appliedAt: new Date(),
        applicationNotes: notes ?? null,
      },
    });

    await AuditService.log({
      userId: meta.userId,
      action: 'UPDATE',
      entityType: 'MaterialSubstitutionRequest',
      entityId: updated.id,
      remarks: notes || 'Approved substitution revalidated and applied to production context',
      newState: toPlainJson(updated),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
