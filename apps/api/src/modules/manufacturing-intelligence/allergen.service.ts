import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../middleware/error.middleware';
import { assertWarehouseAccess, UserContext } from '../inventory/inventory.utils';

export interface AllergenProfile {
  bomId: string;
  bomVersionId: string;
  bomVersionNumber: number;
  derivedAt: string;
  isHistoricalSnapshot: boolean;
  overallStatus: 'CONTAINS_ALLERGENS' | 'CONTAINS_UNKNOWN_INGREDIENTS' | 'NO_KNOWN_ALLERGENS';
  hasUnknownIngredients: boolean;
  confirmedAllergens: string[];
  crossContactAllergens: string[];
  unknownIngredients: Array<{
    inventoryItemId: string;
    code: string;
    name: string;
    reason: string;
  }>;
  ingredientBreakdown: Array<{
    inventoryItemId: string;
    code: string;
    name: string;
    itemType: string;
    allergenStatus: 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'NESTED_BOM';
    allergens: string[];
    crossContactAllergens: string[];
  }>;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

export class AllergenService {
  /**
   * Derive allergen profile from a BOMVersion and its ingredients,
   * recursively traversing nested/intermediate product BOMs with cycle protection.
   * Never claims allergen-free if any ingredient has UNKNOWN allergen status.
   */
  static async deriveBomVersionAllergenProfile(
    bomVersionId: string,
    db: DbClient = prisma,
    visitedBomVersionIds: Set<string> = new Set(),
  ): Promise<AllergenProfile> {
    if (visitedBomVersionIds.has(bomVersionId)) {
      throw new AppError('Circular BOM nesting detected while deriving allergen profile.', 400);
    }
    visitedBomVersionIds.add(bomVersionId);

    const bomVersion = await db.bOMVersion.findUnique({
      where: { id: bomVersionId },
      include: {
        bom: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            inventoryItem: {
              include: {
                rawMaterial: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    allergenStatus: true,
                    allergens: true,
                    crossContactAllergens: true,
                  },
                },
                productVariant: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!bomVersion) {
      throw new AppError('BOM version not found.', 404);
    }

    const confirmedSet = new Set<string>();
    const crossContactSet = new Set<string>();
    const unknownIngredients: AllergenProfile['unknownIngredients'] = [];
    const ingredientBreakdown: AllergenProfile['ingredientBreakdown'] = [];

    for (const item of bomVersion.items) {
      const inv = item.inventoryItem;
      if (inv.rawMaterial) {
        const rm = inv.rawMaterial;
        if (rm.allergenStatus === 'KNOWN') {
          rm.allergens.forEach(a => confirmedSet.add(a));
          rm.crossContactAllergens.forEach(a => crossContactSet.add(a));
        } else if (rm.allergenStatus === 'UNKNOWN') {
          unknownIngredients.push({
            inventoryItemId: inv.id,
            code: inv.code,
            name: inv.name,
            reason: 'Raw material allergen declaration is UNKNOWN',
          });
          rm.crossContactAllergens.forEach(a => crossContactSet.add(a));
        }
        ingredientBreakdown.push({
          inventoryItemId: inv.id,
          code: inv.code,
          name: inv.name,
          itemType: inv.itemType,
          allergenStatus: rm.allergenStatus,
          allergens: rm.allergens,
          crossContactAllergens: rm.crossContactAllergens,
        });
      } else if (inv.productVariant) {
        // Intermediate/nested BOM lookup for semi-finished/finished ingredient
        const nestedBomVersion = await db.bOMVersion.findFirst({
          where: {
            status: 'ACTIVE',
            bom: { productVariantId: inv.productVariant.id, isActive: true },
          },
          orderBy: { versionNumber: 'desc' },
          select: { id: true },
        });

        if (nestedBomVersion && !visitedBomVersionIds.has(nestedBomVersion.id)) {
          const nested = await this.deriveBomVersionAllergenProfile(
            nestedBomVersion.id,
            db,
            new Set(visitedBomVersionIds),
          );
          nested.confirmedAllergens.forEach(a => confirmedSet.add(a));
          nested.crossContactAllergens.forEach(a => crossContactSet.add(a));
          nested.unknownIngredients.forEach(u => unknownIngredients.push(u));
          ingredientBreakdown.push({
            inventoryItemId: inv.id,
            code: inv.code,
            name: inv.name,
            itemType: inv.itemType,
            allergenStatus: 'NESTED_BOM',
            allergens: nested.confirmedAllergens,
            crossContactAllergens: nested.crossContactAllergens,
          });
        } else {
          unknownIngredients.push({
            inventoryItemId: inv.id,
            code: inv.code,
            name: inv.name,
            reason: 'Intermediate product has no active BOM for allergen derivation',
          });
          ingredientBreakdown.push({
            inventoryItemId: inv.id,
            code: inv.code,
            name: inv.name,
            itemType: inv.itemType,
            allergenStatus: 'UNKNOWN',
            allergens: [],
            crossContactAllergens: [],
          });
        }
      } else {
        unknownIngredients.push({
          inventoryItemId: inv.id,
          code: inv.code,
          name: inv.name,
          reason: 'Ingredient lacks linked raw material or product BOM',
        });
        ingredientBreakdown.push({
          inventoryItemId: inv.id,
          code: inv.code,
          name: inv.name,
          itemType: inv.itemType,
          allergenStatus: 'UNKNOWN',
          allergens: [],
          crossContactAllergens: [],
        });
      }
    }

    const confirmedAllergens = Array.from(confirmedSet).sort();
    const crossContactAllergens = Array.from(crossContactSet).sort();
    const hasUnknownIngredients = unknownIngredients.length > 0;

    const overallStatus: AllergenProfile['overallStatus'] =
      confirmedAllergens.length > 0
        ? 'CONTAINS_ALLERGENS'
        : hasUnknownIngredients
          ? 'CONTAINS_UNKNOWN_INGREDIENTS'
          : 'NO_KNOWN_ALLERGENS';

    return {
      bomId: bomVersion.bomId,
      bomVersionId: bomVersion.id,
      bomVersionNumber: bomVersion.versionNumber,
      derivedAt: new Date().toISOString(),
      isHistoricalSnapshot: false,
      overallStatus,
      hasUnknownIngredients,
      confirmedAllergens,
      crossContactAllergens,
      unknownIngredients,
      ingredientBreakdown,
    };
  }

  static async getProductVariantAllergenProfile(productVariantId: string) {
    const activeVersion = await prisma.bOMVersion.findFirst({
      where: {
        status: 'ACTIVE',
        bom: { productVariantId, isActive: true },
      },
      orderBy: { versionNumber: 'desc' },
      select: { id: true },
    });

    if (!activeVersion) {
      throw new AppError('No active BOM version found for this product variant.', 404);
    }

    return this.deriveBomVersionAllergenProfile(activeVersion.id);
  }

  static async getBatchAllergenProfile(batchId: string, user: UserContext): Promise<AllergenProfile> {
    const batch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        warehouseId: true,
        bomVersionId: true,
        allergenSnapshot: true,
      },
    });
    if (!batch) throw new AppError('Production batch not found.', 404);
    await assertWarehouseAccess(user, batch.warehouseId, 'READ');

    if (batch.allergenSnapshot && typeof batch.allergenSnapshot === 'object') {
      return {
        ...(batch.allergenSnapshot as unknown as AllergenProfile),
        isHistoricalSnapshot: true,
      };
    }

    return this.deriveBomVersionAllergenProfile(batch.bomVersionId);
  }
}
