import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data/master-data.utils';
import { UserContext } from '../inventory/inventory.utils';
import { ProductionBatchService } from './production-batch.service';
import {
  cancelOrPauseBatchSchema,
  completeBatchSchema,
  consumeMaterialsSchema,
  createBatchSchema,
  recordOutputSchema,
  reserveBatchMaterialsSchema,
} from './production-batch.types';

const getUserCtx = (req: Request): UserContext => ({
  userId: req.user!.userId,
  roles: req.user!.roles || [],
});

export class ProductionBatchController {
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionBatchService.getDashboardSummary(getUserCtx(req));
      sendSuccess(res, 'Production execution dashboard fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async listBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const data = await ProductionBatchService.listBatches(pagination, getUserCtx(req), {
        status: req.query.status ? String(req.query.status) : undefined,
        workOrderId: req.query.workOrderId ? String(req.query.workOrderId) : undefined,
        warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
      });
      sendSuccess(res, 'Production batches fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getBatchById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionBatchService.getBatchById(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Production batch fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async createBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createBatchSchema.parse(req.body);
      const data = await ProductionBatchService.createBatch(input, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Production batch created', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async startBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionBatchService.startBatch(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production batch started', data);
    } catch (error) {
      next(error);
    }
  }

  static async pauseBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = cancelOrPauseBatchSchema.parse(req.body);
      const data = await ProductionBatchService.pauseBatch(
        String(req.params.id),
        reason,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production batch paused', data);
    } catch (error) {
      next(error);
    }
  }

  static async resumeBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductionBatchService.resumeBatch(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production batch resumed', data);
    } catch (error) {
      next(error);
    }
  }

  static async reserveMaterials(req: Request, res: Response, next: NextFunction) {
    try {
      const { warehouseId } = reserveBatchMaterialsSchema.parse(req.body || {});
      const data = await ProductionBatchService.reserveMaterials(
        String(req.params.id),
        warehouseId,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Materials reserved for production batch', data);
    } catch (error) {
      next(error);
    }
  }

  static async consumeMaterials(req: Request, res: Response, next: NextFunction) {
    try {
      const input = consumeMaterialsSchema.parse(req.body);
      const data = await ProductionBatchService.consumeMaterials(
        String(req.params.id),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Material consumption recorded', data);
    } catch (error) {
      next(error);
    }
  }

  static async recordOutput(req: Request, res: Response, next: NextFunction) {
    try {
      const input = recordOutputSchema.parse(req.body);
      const data = await ProductionBatchService.recordOutput(
        String(req.params.id),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production output recorded', data);
    } catch (error) {
      next(error);
    }
  }

  static async completeBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const input = completeBatchSchema.parse(req.body || {});
      const data = await ProductionBatchService.completeBatch(
        String(req.params.id),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production batch completed and finished goods received', data);
    } catch (error) {
      next(error);
    }
  }

  static async cancelBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = cancelOrPauseBatchSchema.parse(req.body);
      const data = await ProductionBatchService.cancelBatch(
        String(req.params.id),
        reason,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Production batch cancelled', data);
    } catch (error) {
      next(error);
    }
  }
}
