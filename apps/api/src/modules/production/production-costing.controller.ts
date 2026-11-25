import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { getAuditMeta } from '../master-data/master-data.utils';
import { UserContext } from '../inventory/inventory.utils';
import { ProductionCostingService } from './production-costing.service';
import {
  calculateCostingSchema,
  createCostEntrySchema,
  createOverheadAllocationSchema,
  finalizeCostingSchema,
  listCostingsQuerySchema,
  postFinalizationNoteSchema,
  reviewCostEntrySchema,
  reviewCostingSchema,
  varianceReportQuerySchema,
} from './production-costing.types';

const getUserCtx = (req: Request): UserContext => ({
  userId: req.user!.userId,
  roles: req.user!.roles || [],
});

export class ProductionCostingController {
  static async getDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionCostingService.getDashboard();
      sendSuccess(res, 'Production costing dashboard fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async listBatchCostings(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listCostingsQuerySchema.parse(req.query);
      const data = await ProductionCostingService.listBatchCostings(query);
      sendSuccess(res, 'Batch costings fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getBatchCostingDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionCostingService.getBatchCostingDetail(String(req.params.batchId));
      sendSuccess(res, 'Batch costing detail fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async calculateBatchCosting(req: Request, res: Response, next: NextFunction) {
    try {
      const input = calculateCostingSchema.parse(req.body ?? {});
      const data = await ProductionCostingService.calculateBatchCosting(
        String(req.params.batchId),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Batch costing calculated', data);
    } catch (error) {
      next(error);
    }
  }

  static async addCostEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createCostEntrySchema.parse(req.body);
      const data = await ProductionCostingService.addCostEntry(
        String(req.params.batchId),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production cost entry recorded', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async reviewCostEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const input = reviewCostEntrySchema.parse(req.body);
      const data = await ProductionCostingService.reviewCostEntry(
        String(req.params.entryId),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production cost entry reviewed', data);
    } catch (error) {
      next(error);
    }
  }

  static async deleteCostEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionCostingService.deleteCostEntry(
        String(req.params.entryId),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production cost entry deleted', data);
    } catch (error) {
      next(error);
    }
  }

  static async addOverheadAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createOverheadAllocationSchema.parse(req.body);
      const data = await ProductionCostingService.addOverheadAllocation(
        String(req.params.batchId),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Overhead allocation added', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async deleteOverheadAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionCostingService.deleteOverheadAllocation(
        String(req.params.allocationId),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Overhead allocation deleted', data);
    } catch (error) {
      next(error);
    }
  }

  static async reviewBatchCosting(req: Request, res: Response, next: NextFunction) {
    try {
      const input = reviewCostingSchema.parse(req.body ?? {});
      const data = await ProductionCostingService.reviewBatchCosting(
        String(req.params.batchId),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Batch costing reviewed', data);
    } catch (error) {
      next(error);
    }
  }

  static async finalizeBatchCosting(req: Request, res: Response, next: NextFunction) {
    try {
      const input = finalizeCostingSchema.parse(req.body ?? {});
      const data = await ProductionCostingService.finalizeBatchCosting(
        String(req.params.batchId),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Batch costing finalized and FG valuation updated', data);
    } catch (error) {
      next(error);
    }
  }

  static async addPostFinalizationNote(req: Request, res: Response, next: NextFunction) {
    try {
      const input = postFinalizationNoteSchema.parse(req.body);
      const data = await ProductionCostingService.addPostFinalizationNote(
        String(req.params.batchId),
        input.note,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Post-finalization adjustment note recorded', data);
    } catch (error) {
      next(error);
    }
  }

  static async getVarianceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const query = varianceReportQuerySchema.parse(req.query);
      const data = await ProductionCostingService.getVarianceReport(query);
      sendSuccess(res, 'Production cost variance report fetched', data);
    } catch (error) {
      next(error);
    }
  }
}
