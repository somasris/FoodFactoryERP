import { ItemType, Prisma } from '@prisma/client';
import { prisma } from '../../../services/prisma.service';
import { AuditService } from '../../../services/audit.service';
import { AppError } from '../../../middleware/error.middleware';
import { convertQuantityDecimal, ZERO } from '../../inventory/inventory.utils';
import {
  AuditMeta,
  handlePrismaError,
  paginatedResult,
  PaginationParams,
  toPlainJson,
} from '../master-data.utils';
import {
  CreateBomInput,
  CreateBomVersionInput,
  UpdateBomHeaderInput,
  UpdateBomVersionInput,
} from './boms.types';

export class BomsService {
  static async listInventoryItems(params: PaginationParams, itemType?: string) {
    const where: Prisma.InventoryItemWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (itemType) where.itemType = itemType as ItemType;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: { uom: true },
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  private static async checkCircularBom(
    rootProductVariantId: string,
    componentVariantIds: string[],
  ) {
    if (componentVariantIds.length === 0) return;

    const visited = new Set<string>([rootProductVariantId]);
    const queue = [...componentVariantIds];

    while (queue.length > 0) {
      const currentVariantId = queue.shift()!;
      if (visited.has(currentVariantId)) {
        throw new AppError(
          'Circular BOM relationship detected: a product variant cannot directly or indirectly reference itself.',
          400,
        );
      }
      visited.add(currentVariantId);

      const childBoms = await prisma.bOM.findMany({
        where: { productVariantId: currentVariantId, isActive: true },
        include: {
          versions: {
            where: { status: { in: ['ACTIVE', 'DRAFT'] } },
            include: {
              items: {
                include: { inventoryItem: { select: { productVariantId: true } } },
              },
            },
          },
        },
      });

      for (const childBom of childBoms) {
        for (const ver of childBom.versions) {
          for (const item of ver.items) {
            if (item.inventoryItem.productVariantId) {
              queue.push(item.inventoryItem.productVariantId);
            }
          }
        }
      }
    }
  }

  private static async validateVersionItems(
    productVariantId: string,
    outputUomId: string,
    items: CreateBomVersionInput['items'],
  ) {
    const outUom = await prisma.unitOfMeasure.findUnique({ where: { id: outputUomId } });
    if (!outUom || !outUom.isActive) {
      throw new AppError('Referenced output unit of measure is invalid or inactive.', 400);
    }

    const inventoryItemIds = items.map(i => i.inventoryItemId);
    const uomIds = Array.from(new Set(items.map(i => i.uomId)));

    const [invItems, uoms] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { id: { in: inventoryItemIds } } }),
      prisma.unitOfMeasure.findMany({ where: { id: { in: uomIds } } }),
    ]);

    const invMap = new Map(invItems.map(i => [i.id, i]));
    const uomMap = new Map(uoms.map(u => [u.id, u]));

    const componentVariantIds: string[] = [];

    for (const item of items) {
      const inv = invMap.get(item.inventoryItemId);
      if (!inv || !inv.isActive) {
        throw new AppError(
          `Inventory item ${item.inventoryItemId} not found or is inactive.`,
          400,
        );
      }
      const uom = uomMap.get(item.uomId);
      if (!uom || !uom.isActive) {
        throw new AppError(`Unit of measure ${item.uomId} not found or is inactive.`, 400);
      }
      if (inv.productVariantId) {
        componentVariantIds.push(inv.productVariantId);
      }
      // Verify a valid UOM conversion path exists between recipe UOM and inventory base UOM
      await convertQuantityDecimal(prisma, new Prisma.Decimal(1), item.uomId, inv.uomId);
    }

    await this.checkCircularBom(productVariantId, componentVariantIds);

    return invMap;
  }

  static async listBoms(params: PaginationParams, productVariantId?: string) {
    const where: Prisma.BOMWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (productVariantId) where.productVariantId = productVariantId;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { productVariant: { sku: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.bOM.findMany({
        where,
        include: {
          productVariant: { include: { product: true } },
          outputUom: true,
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: { _count: { select: { items: true, overheads: true } } },
          },
        },
        skip: params.skip,
        take: params.take,
        orderBy: { code: 'asc' },
      }),
      prisma.bOM.count({ where }),
    ]);

    return paginatedResult(items, total, params.page, params.limit);
  }

  static async getBomById(id: string) {
    const bom = await prisma.bOM.findUnique({
      where: { id },
      include: {
        productVariant: { include: { product: true } },
        outputUom: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            outputUom: true,
            items: { include: { inventoryItem: true, uom: true } },
            overheads: true,
          },
        },
      },
    });
    if (!bom) throw new AppError('Bill of materials not found.', 404);
    return bom;
  }

  static async createBom(input: CreateBomInput, meta: AuditMeta) {
    try {
      const variant = await prisma.productVariant.findUnique({
        where: { id: input.productVariantId },
      });
      if (!variant || !variant.isActive) {
        throw new AppError('Referenced product variant not found or is inactive.', 400);
      }

      const outUom = await prisma.unitOfMeasure.findUnique({ where: { id: input.outputUomId } });
      if (!outUom || !outUom.isActive) {
        throw new AppError('Referenced output unit of measure not found or is inactive.', 400);
      }

      let invMap: Map<string, { itemType: ItemType }> | undefined;
      if (input.initialVersion) {
        invMap = await this.validateVersionItems(
          input.productVariantId,
          input.initialVersion.outputUomId,
          input.initialVersion.items,
        );
      }

      const created = await prisma.$transaction(async tx => {
        const bom = await tx.bOM.create({
          data: {
            productVariantId: input.productVariantId,
            code: input.code,
            name: input.name,
            baseOutputQuantity: new Prisma.Decimal(input.baseOutputQuantity),
            outputUomId: input.outputUomId,
          },
        });

        if (input.initialVersion && invMap) {
          await tx.bOMVersion.create({
            data: {
              bomId: bom.id,
              versionNumber: 1,
              status: 'DRAFT',
              effectiveFrom: input.initialVersion.effectiveFrom ?? new Date(),
              effectiveTo: input.initialVersion.effectiveTo ?? null,
              expectedGoodOutput: new Prisma.Decimal(input.initialVersion.expectedGoodOutput),
              yieldPercentage: new Prisma.Decimal(input.initialVersion.yieldPercentage ?? '100'),
              expectedWastagePercent: new Prisma.Decimal(
                input.initialVersion.expectedWastagePercent ?? '0',
              ),
              outputUomId: input.initialVersion.outputUomId,
              remarks: input.initialVersion.remarks ?? null,
              items: {
                create: input.initialVersion.items.map(item => ({
                  inventoryItemId: item.inventoryItemId,
                  itemType: invMap!.get(item.inventoryItemId)!.itemType,
                  standardQuantity: new Prisma.Decimal(item.standardQuantity),
                  uomId: item.uomId,
                  scrapTolerancePercent: new Prisma.Decimal(item.scrapTolerancePercent),
                })),
              },
              overheads:
                input.initialVersion.overheads.length > 0
                  ? {
                      create: input.initialVersion.overheads.map(oh => ({
                        costType: oh.costType,
                        description: oh.description,
                        standardAmount: new Prisma.Decimal(oh.standardAmount),
                      })),
                    }
                  : undefined,
            },
          });
        }

        return tx.bOM.findUniqueOrThrow({
          where: { id: bom.id },
          include: {
            productVariant: true,
            outputUom: true,
            versions: {
              include: {
                items: { include: { inventoryItem: true, uom: true } },
                overheads: true,
              },
            },
          },
        });
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'BOM',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'Bill of materials');
    }
  }

  static async updateBomHeader(id: string, input: UpdateBomHeaderInput, meta: AuditMeta) {
    try {
      const existing = await prisma.bOM.findUnique({ where: { id } });
      if (!existing) throw new AppError('Bill of materials not found.', 404);

      if (input.outputUomId) {
        const uom = await prisma.unitOfMeasure.findUnique({ where: { id: input.outputUomId } });
        if (!uom || !uom.isActive) {
          throw new AppError('Referenced output unit of measure not found or is inactive.', 400);
        }
      }

      const updated = await prisma.bOM.update({
        where: { id },
        data: {
          ...(input.code !== undefined && { code: input.code }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.baseOutputQuantity !== undefined && {
            baseOutputQuantity: new Prisma.Decimal(input.baseOutputQuantity),
          }),
          ...(input.outputUomId !== undefined && { outputUomId: input.outputUomId }),
        },
        include: { productVariant: true, outputUom: true },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'BOM',
        entityId: updated.id,
        previousState: toPlainJson(existing),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Bill of materials');
    }
  }

  static async setBomStatus(id: string, isActive: boolean, meta: AuditMeta) {
    try {
      const existing = await prisma.bOM.findUnique({ where: { id } });
      if (!existing) throw new AppError('Bill of materials not found.', 404);

      const updated = await prisma.bOM.update({
        where: { id },
        data: { isActive },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'BOM',
        entityId: updated.id,
        previousState: { isActive: existing.isActive },
        newState: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: isActive ? 'Activated BOM' : 'Deactivated BOM',
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'Bill of materials');
    }
  }

  static async createVersion(bomId: string, input: CreateBomVersionInput, meta: AuditMeta) {
    try {
      const bom = await prisma.bOM.findUnique({
        where: { id: bomId },
        include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      });
      if (!bom) throw new AppError('Bill of materials not found.', 404);

      const invMap = await this.validateVersionItems(
        bom.productVariantId,
        input.outputUomId,
        input.items,
      );

      const nextVersionNumber = (bom.versions[0]?.versionNumber ?? 0) + 1;

      const created = await prisma.bOMVersion.create({
        data: {
          bomId,
          versionNumber: nextVersionNumber,
          status: 'DRAFT',
          effectiveFrom: input.effectiveFrom ?? new Date(),
          effectiveTo: input.effectiveTo ?? null,
          expectedGoodOutput: new Prisma.Decimal(input.expectedGoodOutput),
          yieldPercentage: new Prisma.Decimal(input.yieldPercentage ?? '100'),
          expectedWastagePercent: new Prisma.Decimal(input.expectedWastagePercent ?? '0'),
          outputUomId: input.outputUomId,
          remarks: input.remarks ?? null,
          items: {
            create: input.items.map(item => ({
              inventoryItemId: item.inventoryItemId,
              itemType: invMap.get(item.inventoryItemId)!.itemType,
              standardQuantity: new Prisma.Decimal(item.standardQuantity),
              uomId: item.uomId,
              scrapTolerancePercent: new Prisma.Decimal(item.scrapTolerancePercent),
            })),
          },
          overheads:
            input.overheads.length > 0
              ? {
                  create: input.overheads.map(oh => ({
                    costType: oh.costType,
                    description: oh.description,
                    standardAmount: new Prisma.Decimal(oh.standardAmount),
                  })),
                }
              : undefined,
        },
        include: {
          outputUom: true,
          items: { include: { inventoryItem: true, uom: true } },
          overheads: true,
        },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'CREATE',
        entityType: 'BOMVersion',
        entityId: created.id,
        newState: toPlainJson(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: `Created BOM version v${created.versionNumber}`,
      });

      return created;
    } catch (error) {
      return handlePrismaError(error, 'BOM version');
    }
  }

  static async updateDraftVersion(
    bomId: string,
    versionId: string,
    input: UpdateBomVersionInput,
    meta: AuditMeta,
  ) {
    try {
      const version = await prisma.bOMVersion.findFirst({
        where: { id: versionId, bomId },
        include: { bom: true, items: true, overheads: true },
      });
      if (!version) throw new AppError('BOM version not found.', 404);

      if (version.status !== 'DRAFT') {
        throw new AppError(
          `Cannot modify ${version.status} BOM version. Create a new version to preserve historical traceability.`,
          400,
        );
      }

      const invMap = await this.validateVersionItems(
        version.bom.productVariantId,
        input.outputUomId,
        input.items,
      );

      const updated = await prisma.$transaction(async tx => {
        await tx.bOMItem.deleteMany({ where: { bomVersionId: versionId } });
        await tx.bOMOverhead.deleteMany({ where: { bomVersionId: versionId } });

        return tx.bOMVersion.update({
          where: { id: versionId },
          data: {
            effectiveFrom: input.effectiveFrom ?? version.effectiveFrom,
            effectiveTo: input.effectiveTo ?? null,
            expectedGoodOutput: new Prisma.Decimal(input.expectedGoodOutput),
            yieldPercentage: new Prisma.Decimal(input.yieldPercentage ?? '100'),
            expectedWastagePercent: new Prisma.Decimal(input.expectedWastagePercent ?? '0'),
            outputUomId: input.outputUomId,
            remarks: input.remarks ?? null,
            items: {
              create: input.items.map(item => ({
                inventoryItemId: item.inventoryItemId,
                itemType: invMap.get(item.inventoryItemId)!.itemType,
                standardQuantity: new Prisma.Decimal(item.standardQuantity),
                uomId: item.uomId,
                scrapTolerancePercent: new Prisma.Decimal(item.scrapTolerancePercent),
              })),
            },
            overheads:
              input.overheads.length > 0
                ? {
                    create: input.overheads.map(oh => ({
                      costType: oh.costType,
                      description: oh.description,
                      standardAmount: new Prisma.Decimal(oh.standardAmount),
                    })),
                  }
                : undefined,
          },
          include: {
            outputUom: true,
            items: { include: { inventoryItem: true, uom: true } },
            overheads: true,
          },
        });
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'BOMVersion',
        entityId: updated.id,
        previousState: toPlainJson(version),
        newState: toPlainJson(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'BOM version');
    }
  }

  static async activateVersion(bomId: string, versionId: string, meta: AuditMeta) {
    try {
      const version = await prisma.bOMVersion.findFirst({
        where: { id: versionId, bomId },
        include: { bom: true, items: true },
      });
      if (!version) throw new AppError('BOM version not found.', 404);
      if (version.status === 'ACTIVE') {
        throw new AppError('BOM version is already active.', 400);
      }
      if (version.status === 'OBSOLETE') {
        throw new AppError('Cannot re-activate an obsolete BOM version. Create a new version.', 400);
      }
      if (version.items.length === 0) {
        throw new AppError('Cannot activate a BOM version without component items.', 400);
      }

      // Re-validate active ingredients, UOM conversions, and non-circularity at activation time
      await this.validateVersionItems(
        version.bom.productVariantId,
        version.outputUomId,
        version.items.map(i => ({
          inventoryItemId: i.inventoryItemId,
          standardQuantity: i.standardQuantity.toString(),
          uomId: i.uomId,
          scrapTolerancePercent: i.scrapTolerancePercent.toString(),
        })),
      );

      const now = new Date();

      const activated = await prisma.$transaction(async tx => {
        await tx.bOMVersion.updateMany({
          where: { bomId, status: 'ACTIVE' },
          data: { status: 'OBSOLETE', effectiveTo: now },
        });

        return tx.bOMVersion.update({
          where: { id: versionId },
          data: {
            status: 'ACTIVE',
            approvedById: meta.userId || null,
            approvedAt: now,
          },
          include: {
            outputUom: true,
            items: { include: { inventoryItem: true, uom: true } },
            overheads: true,
          },
        });
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'APPROVE',
        entityType: 'BOMVersion',
        entityId: activated.id,
        previousState: { status: version.status },
        newState: { status: activated.status },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: `Activated BOM version v${activated.versionNumber}`,
      });

      return activated;
    } catch (error) {
      return handlePrismaError(error, 'BOM version');
    }
  }

  static async obsoleteVersion(
    bomId: string,
    versionId: string,
    reason: string | undefined,
    meta: AuditMeta,
  ) {
    try {
      const version = await prisma.bOMVersion.findFirst({
        where: { id: versionId, bomId },
      });
      if (!version) throw new AppError('BOM version not found.', 404);
      if (version.status === 'OBSOLETE') {
        throw new AppError('BOM version is already obsolete.', 400);
      }

      const now = new Date();
      const updated = await prisma.bOMVersion.update({
        where: { id: versionId },
        data: {
          status: 'OBSOLETE',
          effectiveTo: now,
          ...(reason ? { remarks: reason } : {}),
        },
        include: {
          outputUom: true,
          items: { include: { inventoryItem: true, uom: true } },
          overheads: true,
        },
      });

      await AuditService.log({
        userId: meta.userId,
        action: 'UPDATE',
        entityType: 'BOMVersion',
        entityId: updated.id,
        previousState: { status: version.status },
        newState: { status: updated.status },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        remarks: reason || `Marked BOM version v${updated.versionNumber} obsolete`,
      });

      return updated;
    } catch (error) {
      return handlePrismaError(error, 'BOM version');
    }
  }

  static async getVersionCostEstimate(
    bomId: string,
    versionId: string,
    batchQuantityStr?: string,
  ) {
    const version = await prisma.bOMVersion.findFirst({
      where: { id: versionId, bomId },
      include: {
        bom: { include: { productVariant: true } },
        outputUom: true,
        items: { include: { inventoryItem: { include: { uom: true } }, uom: true } },
        overheads: true,
      },
    });
    if (!version) throw new AppError('BOM version not found.', 404);

    const baseGoodOutput = new Prisma.Decimal(version.expectedGoodOutput);
    const targetOutput = batchQuantityStr ? new Prisma.Decimal(batchQuantityStr) : baseGoodOutput;
    if (targetOutput.lte(ZERO)) {
      throw new AppError('Target batch quantity must be greater than zero.', 400);
    }

    const scaleFactor = targetOutput.div(baseGoodOutput);
    const HUNDRED = new Prisma.Decimal(100);

    let totalStandardMaterialCost = ZERO;
    let totalEffectiveMaterialCost = ZERO;
    const itemBreakdown = [];

    for (const item of version.items) {
      const scaledQty = new Prisma.Decimal(item.standardQuantity).mul(scaleFactor).toDecimalPlaces(4);
      const scrapPct = new Prisma.Decimal(item.scrapTolerancePercent);
      const effectiveQty = scaledQty
        .mul(HUNDRED.add(scrapPct))
        .div(HUNDRED)
        .toDecimalPlaces(4);

      const { converted: baseQty } = await convertQuantityDecimal(
        prisma,
        scaledQty,
        item.uomId,
        item.inventoryItem.uomId,
      );
      const { converted: effectiveBaseQty } = await convertQuantityDecimal(
        prisma,
        effectiveQty,
        item.uomId,
        item.inventoryItem.uomId,
      );

      const unitCost = new Prisma.Decimal(item.inventoryItem.movingAverageCost);
      const standardCost = baseQty.mul(unitCost).toDecimalPlaces(2);
      const effectiveCost = effectiveBaseQty.mul(unitCost).toDecimalPlaces(2);

      totalStandardMaterialCost = totalStandardMaterialCost.add(standardCost);
      totalEffectiveMaterialCost = totalEffectiveMaterialCost.add(effectiveCost);

      itemBreakdown.push({
        id: item.id,
        inventoryItemId: item.inventoryItemId,
        itemCode: item.inventoryItem.code,
        itemName: item.inventoryItem.name,
        itemType: item.itemType,
        recipeUomSymbol: item.uom.symbol,
        baseUomSymbol: item.inventoryItem.uom.symbol,
        standardQuantity: scaledQty.toFixed(4),
        scrapTolerancePercent: scrapPct.toFixed(2),
        effectiveQuantity: effectiveQty.toFixed(4),
        effectiveBaseQuantity: effectiveBaseQty.toFixed(4),
        unitMwacCost: unitCost.toFixed(4),
        standardCost: standardCost.toFixed(2),
        effectiveCost: effectiveCost.toFixed(2),
      });
    }

    let totalOverheadCost = ZERO;
    const overheadBreakdown = version.overheads.map(oh => {
      const scaled = new Prisma.Decimal(oh.standardAmount).mul(scaleFactor).toDecimalPlaces(2);
      totalOverheadCost = totalOverheadCost.add(scaled);
      return {
        id: oh.id,
        costType: oh.costType,
        description: oh.description,
        standardAmount: scaled.toFixed(2),
      };
    });

    const totalEstimatedCost = totalEffectiveMaterialCost.add(totalOverheadCost).toDecimalPlaces(2);
    const estimatedUnitCost = totalEstimatedCost.div(targetOutput).toDecimalPlaces(4);

    return {
      bomId,
      versionId,
      versionNumber: version.versionNumber,
      status: version.status,
      targetOutputQuantity: targetOutput.toFixed(4),
      outputUomSymbol: version.outputUom.symbol,
      yieldPercentage: new Prisma.Decimal(version.yieldPercentage).toFixed(2),
      expectedWastagePercent: new Prisma.Decimal(version.expectedWastagePercent).toFixed(2),
      totalStandardMaterialCost: totalStandardMaterialCost.toFixed(2),
      totalEffectiveMaterialCost: totalEffectiveMaterialCost.toFixed(2),
      totalOverheadCost: totalOverheadCost.toFixed(2),
      totalEstimatedCost: totalEstimatedCost.toFixed(2),
      estimatedUnitCost: estimatedUnitCost.toFixed(4),
      items: itemBreakdown,
      overheads: overheadBreakdown,
    };
  }

  static async getBomAuditHistory(bomId: string) {
    const bom = await prisma.bOM.findUnique({
      where: { id: bomId },
      include: { versions: { select: { id: true } } },
    });
    if (!bom) throw new AppError('Bill of materials not found.', 404);

    const versionIds = bom.versions.map(v => v.id);
    return prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'BOM', entityId: bomId },
          ...(versionIds.length > 0
            ? [{ entityType: 'BOMVersion', entityId: { in: versionIds } }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, fullName: true, username: true } } },
    });
  }
}
