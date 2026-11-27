import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { parsePagination } from '../master-data/master-data.utils';
import {
  allocatePaymentSchema,
  createCustomerPaymentSchema,
  reversePaymentSchema,
} from './customer-payment.types';
import { CustomerPaymentService } from './customer-payment.service';
import { ComplianceExportService, ExportFormat } from '../compliance/compliance-export.service';

const getUserContext = (req: Request) => {
  if (!req.user) throw new AppError('Authentication required.', 401);
  return {
    userId: req.user.userId,
    username: req.user.username,
    roles: req.user.roles || [],
  };
};

const getAuditMeta = (req: Request) => ({
  userId: req.user?.userId || '',
  ipAddress: req.ip || req.socket.remoteAddress,
  userAgent: req.headers['user-agent'],
});

export class CustomerPaymentController {
  static async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query);
      const data = await CustomerPaymentService.listPayments(params, {
        customerId: req.query.customerId ? String(req.query.customerId) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        paymentMode: req.query.paymentMode ? String(req.query.paymentMode) : undefined,
        fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
        toDate: req.query.toDate ? String(req.query.toDate) : undefined,
      });
      sendSuccess(res, 'Customer payments retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CustomerPaymentService.getPaymentById(String(req.params.id));
      sendSuccess(res, 'Customer payment retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async createPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createCustomerPaymentSchema.parse(req.body);
      const created = await CustomerPaymentService.createPayment(
        input,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Customer payment recorded successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  static async allocatePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const input = allocatePaymentSchema.parse(req.body);
      const updated = await CustomerPaymentService.allocatePayment(
        String(req.params.id),
        input,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Payment allocated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  static async reversePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = reversePaymentSchema.parse(req.body);
      const reversed = await CustomerPaymentService.reversePayment(
        String(req.params.id),
        reason,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Customer payment reversed successfully', reversed);
    } catch (err) {
      next(err);
    }
  }

  static async getInvoicePaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CustomerPaymentService.getInvoicePaymentHistory(
        String(req.params.id),
        getUserContext(req),
      );
      sendSuccess(res, 'Invoice payment history retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerPaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CustomerPaymentService.getCustomerPaymentHistory(
        String(req.params.customerId),
      );
      sendSuccess(res, 'Customer payment history retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerOutstanding(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CustomerPaymentService.getCustomerOutstanding(
        String(req.params.customerId),
        getUserContext(req),
      );
      sendSuccess(res, 'Customer outstanding retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getReceivablesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CustomerPaymentService.getReceivablesReport(getUserContext(req), {
        customerId: req.query.customerId ? String(req.query.customerId) : undefined,
        invoiceId: req.query.invoiceId ? String(req.query.invoiceId) : undefined,
        fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
        toDate: req.query.toDate ? String(req.query.toDate) : undefined,
      });
      sendSuccess(res, 'Receivables report retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getAgeingReport(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format ? String(req.query.format).toLowerCase() : undefined;
      if (format === 'csv' || format === 'excel' || format === 'pdf') {
        const exported = await ComplianceExportService.generateReceivablesAgeingExport(
          format as ExportFormat,
          getUserContext(req),
          {
            asOfDate: req.query.asOfDate ? String(req.query.asOfDate) : undefined,
            customerId: req.query.customerId ? String(req.query.customerId) : undefined,
            invoiceId: req.query.invoiceId ? String(req.query.invoiceId) : undefined,
            fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
            toDate: req.query.toDate ? String(req.query.toDate) : undefined,
          },
        );
        res.setHeader('Content-Type', exported.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
        res.send(exported.buffer);
        return;
      }

      const data = await CustomerPaymentService.getAgeingReport(getUserContext(req), {
        asOfDate: req.query.asOfDate ? String(req.query.asOfDate) : undefined,
        customerId: req.query.customerId ? String(req.query.customerId) : undefined,
        invoiceId: req.query.invoiceId ? String(req.query.invoiceId) : undefined,
        fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
        toDate: req.query.toDate ? String(req.query.toDate) : undefined,
      });
      sendSuccess(res, 'Receivables ageing report retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }
}
