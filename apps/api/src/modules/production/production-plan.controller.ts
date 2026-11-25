import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data/master-data.utils';
import { UserContext } from '../inventory/inventory.utils';
import {
  createProductionPlanSchema,
  rejectOrCancelPlanSchema,
  updateProductionPlanSchema,
} from './production-plan.types';
import { ProductionPlanService } from './production-plan.service';

const getUserCtx = (req: Request): UserContext => ({
  userId: req.user!.userId,
  roles: req.user!.roles || [],
});

const getStr = (val: unknown): string | undefined =>
  typeof val === 'string' && val.trim() ? val.trim() : undefined;

export class ProductionPlanController {
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionPlanService.getDashboardSummary(getUserCtx(req));
      sendSuccess(res, 'Production planning dashboard retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getDemand(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionPlanService.getDemandSummary(getUserCtx(req), {
        warehouseId: getStr(req.query.warehouseId),
        fromDate: getStr(req.query.fromDate),
        toDate: getStr(req.query.toDate),
      });
      sendSuccess(res, 'Production demand summary retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async listPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await ProductionPlanService.listPlans(params, getUserCtx(req), {
        status: getStr(req.query.status),
        warehouseId: getStr(req.query.warehouseId),
        fromDate: getStr(req.query.fromDate),
        toDate: getStr(req.query.toDate),
      });
      sendSuccess(res, 'Production plans retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getPlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionPlanService.getPlanById(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Production plan retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getMaterialAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionPlanService.getPlanMaterialAvailability(
        String(req.params.id),
        getUserCtx(req),
      );
      sendSuccess(res, 'Material availability analysis retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async createPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createProductionPlanSchema.parse(req.body);
      const data = await ProductionPlanService.createPlan(
        validated,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production plan created successfully', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateProductionPlanSchema.parse(req.body);
      const data = await ProductionPlanService.updateDraftPlan(
        String(req.params.id),
        validated,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production plan updated successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async submitPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionPlanService.submitPlan(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production plan submitted successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async approvePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionPlanService.approvePlan(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production plan approved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async rejectPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = rejectOrCancelPlanSchema.parse(req.body);
      const data = await ProductionPlanService.rejectPlan(
        String(req.params.id),
        reason,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production plan rejected successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async releasePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionPlanService.releasePlan(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production plan released successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async cancelPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = rejectOrCancelPlanSchema.parse(req.body);
      const data = await ProductionPlanService.cancelPlan(
        String(req.params.id),
        reason,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production plan cancelled successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
