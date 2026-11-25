import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data/master-data.utils';
import { UserContext } from '../inventory/inventory.utils';
import { MaterialFgService } from './material-fg.service';
import {
  inspectQualitySchema,
  releaseOrDispositionSchema,
  returnMaterialsSchema,
  varianceApprovalSchema,
} from './material-fg.types';
import { reserveBatchMaterialsSchema } from './production-batch.types';

const getUserCtx = (req: Request): UserContext => ({
  userId: req.user!.userId,
  roles: req.user!.roles || [],
});

export class MaterialFgController {
  static async getReconciliationDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await MaterialFgService.getReconciliationDashboard(getUserCtx(req));
      sendSuccess(res, 'Material reconciliation dashboard fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getBatchReconciliation(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await MaterialFgService.getBatchReconciliation(
        String(req.params.id),
        getUserCtx(req),
      );
      sendSuccess(res, 'Batch material reconciliation fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async returnMaterials(req: Request, res: Response, next: NextFunction) {
    try {
      const input = returnMaterialsSchema.parse(req.body);
      const data = await MaterialFgService.returnMaterials(
        String(req.params.id),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Materials returned to inventory', data);
    } catch (error) {
      next(error);
    }
  }

  static async releaseReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const { warehouseId } = reserveBatchMaterialsSchema.parse(req.body || {});
      const data = await MaterialFgService.releaseUnusedReservation(
        String(req.params.id),
        warehouseId,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Unused material reservations released', data);
    } catch (error) {
      next(error);
    }
  }

  static async approveVariance(req: Request, res: Response, next: NextFunction) {
    try {
      const input = varianceApprovalSchema.parse(req.body);
      const data = await MaterialFgService.approveVariance(
        String(req.params.id),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Material consumption variance decision recorded', data);
    } catch (error) {
      next(error);
    }
  }

  static async listQualityInspections(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req.query as Record<string, unknown>);
      const data = await MaterialFgService.listQualityInspections(pagination, getUserCtx(req), {
        decision: req.query.decision ? String(req.query.decision) : undefined,
        warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
      });
      sendSuccess(res, 'Quality inspections fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async inspectQuality(req: Request, res: Response, next: NextFunction) {
    try {
      const input = inspectQualitySchema.parse(req.body);
      const data = await MaterialFgService.inspectQuality(
        String(req.params.id),
        input,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Quality inspection recorded', data);
    } catch (error) {
      next(error);
    }
  }

  static async releaseQuarantined(req: Request, res: Response, next: NextFunction) {
    try {
      const { releaseNotes } = releaseOrDispositionSchema.parse(req.body);
      const data = await MaterialFgService.releaseOrDispositionQuarantined(
        String(req.params.id),
        'RELEASE',
        releaseNotes,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Quarantined stock released to saleable inventory', data);
    } catch (error) {
      next(error);
    }
  }

  static async dispositionRejected(req: Request, res: Response, next: NextFunction) {
    try {
      const { releaseNotes } = releaseOrDispositionSchema.parse(req.body);
      const data = await MaterialFgService.releaseOrDispositionQuarantined(
        String(req.params.id),
        'REJECT',
        releaseNotes,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Quarantined stock dispositioned as rejected', data);
    } catch (error) {
      next(error);
    }
  }

  static async recallLookup(req: Request, res: Response, next: NextFunction) {
    try {
      const batchNumber = req.query.batchNumber ? String(req.query.batchNumber) : '';
      const data = await MaterialFgService.recallLookup(batchNumber, getUserCtx(req));
      sendSuccess(res, 'Batch traceability lookup completed', data);
    } catch (error) {
      next(error);
    }
  }
}
