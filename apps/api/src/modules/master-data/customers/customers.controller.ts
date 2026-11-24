import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data.utils';
import { toggleStatusSchema } from '../uom/uom.types';
import { CustomersService } from './customers.service';
import { createCustomerSchema, updateCustomerSchema } from './customers.types';

export class CustomersController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const customerType =
        typeof req.query.customerType === 'string' ? req.query.customerType : undefined;
      const result = await CustomersService.listCustomers(params, customerType);
      sendSuccess(res, 'Customers retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await CustomersService.getCustomerById(String(req.params.id));
      sendSuccess(res, 'Customer retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createCustomerSchema.parse(req.body);
      const created = await CustomersService.createCustomer(validated, getAuditMeta(req));
      sendSuccess(res, 'Customer created successfully', created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateCustomerSchema.parse(req.body);
      const updated = await CustomersService.updateCustomer(
        String(req.params.id),
        validated,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Customer updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = toggleStatusSchema.parse(req.body);
      const updated = await CustomersService.setCustomerStatus(
        String(req.params.id),
        isActive,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Customer status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }
}
