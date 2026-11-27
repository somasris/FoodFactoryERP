import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data/master-data.utils';
import { UserContext } from '../inventory/inventory.utils';
import {
  cancelSalesOrderSchema,
  confirmSalesOrderSchema,
  createSalesOrderSchema,
  fulfillSalesOrderSchema,
  rejectSalesOrderSchema,
  updateSalesOrderSchema,
} from './sales.types';
import { SalesService } from './sales.service';

const getUserCtx = (req: Request): UserContext => ({
  userId: req.user!.userId,
  roles: req.user!.roles || [],
  permissions: req.user!.permissions || [],
});

const getStr = (val: unknown): string | undefined =>
  typeof val === 'string' && val.trim() ? val.trim() : undefined;

export class SalesController {
  static async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalesService.getDashboardSummary(getUserCtx(req), {
        fromDate: getStr(req.query.fromDate),
        toDate: getStr(req.query.toDate),
      });
      sendSuccess(res, 'Sales dashboard retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await SalesService.listOrders(params, getUserCtx(req), {
        status: getStr(req.query.status),
        customerId: getStr(req.query.customerId),
        warehouseId: getStr(req.query.warehouseId),
        fromDate: getStr(req.query.fromDate),
        toDate: getStr(req.query.toDate),
        stockAvailability: getStr(req.query.stockAvailability),
        sortBy: getStr(req.query.sortBy),
        sortOrder: getStr(req.query.sortOrder),
      });
      sendSuccess(res, 'Sales orders retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async listCustomerOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await SalesService.listOrders(params, getUserCtx(req), {
        customerId: String(req.params.customerId),
        status: getStr(req.query.status),
      });
      sendSuccess(res, 'Customer sales orders retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalesService.getOrderById(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Sales order retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getOrderHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalesService.getOrderHistory(String(req.params.id), getUserCtx(req));
      sendSuccess(res, 'Sales order history retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createSalesOrderSchema.parse(req.body);
      const data = await SalesService.createOrder(validated, getUserCtx(req), getAuditMeta(req));
      sendSuccess(res, 'Sales order created successfully', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateSalesOrderSchema.parse(req.body);
      const data = await SalesService.updateOrder(
        String(req.params.id),
        validated,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales order updated successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async submitOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalesService.submitOrder(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales order submitted successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async approveOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalesService.approveOrder(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales order approved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async rejectOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = rejectSalesOrderSchema.parse(req.body);
      const data = await SalesService.rejectOrder(
        String(req.params.id),
        reason,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales order rejected successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async confirmOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { idempotencyKey } = confirmSalesOrderSchema.parse(req.body || {});
      const data = await SalesService.confirmOrder(
        String(req.params.id),
        idempotencyKey,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales order confirmed and stock reserved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = cancelSalesOrderSchema.parse(req.body);
      const data = await SalesService.cancelOrder(
        String(req.params.id),
        reason,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales order cancelled successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async fulfillOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = fulfillSalesOrderSchema.parse(req.body || {});
      const data = await SalesService.fulfillOrder(
        String(req.params.id),
        validated,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales order fulfilled successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
