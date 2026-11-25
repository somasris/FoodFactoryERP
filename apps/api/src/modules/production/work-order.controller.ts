import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data/master-data.utils';
import { UserContext } from '../inventory/inventory.utils';
import {
  createWorkOrderSchema,
  rejectOrCancelWorkOrderSchema,
  updateWorkOrderSchema,
} from './work-order.types';
import { WorkOrderService } from './work-order.service';

const getUserCtx = (req: Request): UserContext => ({
  userId: req.user!.userId,
  roles: req.user!.roles || [],
});

const getStr = (val: unknown): string | undefined =>
  typeof val === 'string' && val.trim() ? val.trim() : undefined;

export class WorkOrderController {
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WorkOrderService.getDashboardSummary(getUserCtx(req));
      sendSuccess(res, 'Work order dashboard retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async listWorkOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await WorkOrderService.listWorkOrders(params, getUserCtx(req), {
        status: getStr(req.query.status),
        priority: getStr(req.query.priority),
        warehouseId: getStr(req.query.warehouseId),
        productionPlanId: getStr(req.query.productionPlanId),
        fromDate: getStr(req.query.fromDate),
        toDate: getStr(req.query.toDate),
      });
      sendSuccess(res, 'Work orders retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getWorkOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WorkOrderService.getWorkOrderById(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Work order retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getMaterialRequirements(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WorkOrderService.getMaterialRequirements(
        String(req.params.id),
        getUserCtx(req),
      );
      sendSuccess(res, 'Work order material requirements retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async createWorkOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createWorkOrderSchema.parse(req.body);
      const data = await WorkOrderService.createWorkOrder(
        validated,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Work order created successfully', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateWorkOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateWorkOrderSchema.parse(req.body);
      const data = await WorkOrderService.updateDraftWorkOrder(
        String(req.params.id),
        validated,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Work order updated successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async submitWorkOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WorkOrderService.submitWorkOrder(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Work order submitted successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async approveWorkOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WorkOrderService.approveWorkOrder(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Work order approved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async rejectWorkOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = rejectOrCancelWorkOrderSchema.parse(req.body);
      const data = await WorkOrderService.rejectWorkOrder(
        String(req.params.id),
        reason,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Work order rejected successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async releaseWorkOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await WorkOrderService.releaseWorkOrder(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Work order released successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async cancelWorkOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = rejectOrCancelWorkOrderSchema.parse(req.body);
      const data = await WorkOrderService.cancelWorkOrder(
        String(req.params.id),
        reason,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Work order cancelled successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
