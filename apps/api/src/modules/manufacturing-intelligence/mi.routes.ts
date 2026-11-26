import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { ManufacturingIntelligenceController } from './mi.controller';

export const manufacturingIntelligenceRouter = Router();

manufacturingIntelligenceRouter.use(authenticate);

// 1. Batch Journey Timeline
manufacturingIntelligenceRouter.get(
  '/batches/:batchId/journey',
  requirePermissions('production.batches.read'),
  ManufacturingIntelligenceController.getBatchJourney,
);

// 2. Allergen Alert System
manufacturingIntelligenceRouter.get(
  '/allergens/categories',
  ManufacturingIntelligenceController.getAllergenCategories,
);
manufacturingIntelligenceRouter.get(
  '/allergens/bom-version/:bomVersionId',
  requirePermissions('bom.read'),
  ManufacturingIntelligenceController.getBomVersionAllergens,
);
manufacturingIntelligenceRouter.get(
  '/allergens/product-variant/:productVariantId',
  requirePermissions('master_data.read'),
  ManufacturingIntelligenceController.getProductVariantAllergens,
);
manufacturingIntelligenceRouter.get(
  '/allergens/batches/:batchId',
  requirePermissions('production.batches.read'),
  ManufacturingIntelligenceController.getBatchAllergens,
);

// 3. Shelf-Life Risk Radar
manufacturingIntelligenceRouter.get(
  '/shelf-life-radar',
  requirePermissions('inventory.read'),
  ManufacturingIntelligenceController.getShelfLifeRadar,
);

// 4. Production Efficiency Scorecard
manufacturingIntelligenceRouter.get(
  '/efficiency-scorecard',
  requirePermissions('production.reports.read'),
  ManufacturingIntelligenceController.getEfficiencyScorecard,
);
