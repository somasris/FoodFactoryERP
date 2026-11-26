import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { UserContext } from '../inventory/inventory.utils';
import { SyncUserContext } from '../sync/sync.service';
import { AllergenService } from './allergen.service';
import { BatchJourneyService } from './batch-journey.service';
import { ShelfLifeRadarService } from './shelf-life-radar.service';
import { EfficiencyScorecardService } from './efficiency-scorecard.service';
import {
  ALLERGEN_CATEGORIES,
  efficiencyScorecardQuerySchema,
  shelfLifeRadarQuerySchema,
} from './mi.types';

function toUserContext(req: Request): UserContext {
  return {
    userId: req.user!.userId,
    roles: req.user!.roles,
  };
}

function toSyncUserContext(req: Request): SyncUserContext {
  return {
    userId: req.user!.userId,
    username: req.user!.username,
    roles: req.user!.roles,
    permissions: req.user!.permissions,
  };
}

export class ManufacturingIntelligenceController {
  static async getBatchJourney(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await BatchJourneyService.getBatchJourney(
        String(req.params.batchId),
        toSyncUserContext(req),
      );
      sendSuccess(res, 'Batch journey retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getAllergenCategories(_req: Request, res: Response) {
    sendSuccess(res, 'Allergen categories retrieved', ALLERGEN_CATEGORIES);
  }

  static async getBomVersionAllergens(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AllergenService.deriveBomVersionAllergenProfile(
        String(req.params.bomVersionId),
      );
      sendSuccess(res, 'BOM version allergen profile derived', data);
    } catch (err) {
      next(err);
    }
  }

  static async getProductVariantAllergens(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AllergenService.getProductVariantAllergenProfile(
        String(req.params.productVariantId),
      );
      sendSuccess(res, 'Product variant allergen profile derived', data);
    } catch (err) {
      next(err);
    }
  }

  static async getBatchAllergens(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AllergenService.getBatchAllergenProfile(
        String(req.params.batchId),
        toUserContext(req),
      );
      sendSuccess(res, 'Batch allergen profile retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async getShelfLifeRadar(req: Request, res: Response, next: NextFunction) {
    try {
      const query = shelfLifeRadarQuerySchema.parse(req.query);
      const data = await ShelfLifeRadarService.getRadar(toUserContext(req), query);
      sendSuccess(res, 'Shelf-life risk radar retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async getEfficiencyScorecard(req: Request, res: Response, next: NextFunction) {
    try {
      const query = efficiencyScorecardQuerySchema.parse(req.query);
      const data = await EfficiencyScorecardService.getScorecard(toUserContext(req), query);
      sendSuccess(res, 'Production efficiency scorecard retrieved', data);
    } catch (err) {
      next(err);
    }
  }
}
