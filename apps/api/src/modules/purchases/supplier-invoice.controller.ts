import { Request, Response, NextFunction } from 'express';
import { ItcStatus } from '@prisma/client';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { parsePagination } from '../master-data/master-data.utils';
import {
  cancelSupplierInvoiceSchema,
  createSupplierInvoiceSchema,
  matchReceiptsSchema,
  updateItcSchema,
  updateSupplierInvoiceSchema,
} from './supplier-invoice.types';
import { SupplierInvoiceService } from './supplier-invoice.service';
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

export class SupplierInvoiceController {
  static async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query);
      const data = await SupplierInvoiceService.listInvoices(params, {
        supplierId: req.query.supplierId ? String(req.query.supplierId) : undefined,
        factoryId: req.query.factoryId ? String(req.query.factoryId) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        matchingStatus: req.query.matchingStatus ? String(req.query.matchingStatus) : undefined,
        itcStatus: req.query.itcStatus ? String(req.query.itcStatus) : undefined,
        gstin: req.query.gstin ? String(req.query.gstin) : undefined,
        fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
        toDate: req.query.toDate ? String(req.query.toDate) : undefined,
      });
      sendSuccess(res, 'Supplier invoices retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SupplierInvoiceService.getById(String(req.params.id));
      sendSuccess(res, 'Supplier invoice retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async createDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createSupplierInvoiceSchema.parse(req.body);
      const created = await SupplierInvoiceService.createDraft(
        input,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Supplier invoice draft created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateSupplierInvoiceSchema.parse(req.body);
      const updated = await SupplierInvoiceService.updateDraft(
        String(req.params.id),
        input,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Supplier invoice draft updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  static async postInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const posted = await SupplierInvoiceService.postInvoice(
        String(req.params.id),
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Supplier invoice posted successfully', posted);
    } catch (err) {
      next(err);
    }
  }

  static async cancelInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = cancelSupplierInvoiceSchema.parse(req.body);
      const cancelled = await SupplierInvoiceService.cancelInvoice(
        String(req.params.id),
        reason,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Supplier invoice cancelled successfully', cancelled);
    } catch (err) {
      next(err);
    }
  }

  static async updateItcStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { itcStatus, itcNotes } = updateItcSchema.parse(req.body);
      const updated = await SupplierInvoiceService.updateItcStatus(
        String(req.params.id),
        itcStatus as ItcStatus,
        itcNotes,
        getAuditMeta(req),
      );
      sendSuccess(res, 'ITC classification updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  static async matchToReceipts(req: Request, res: Response, next: NextFunction) {
    try {
      const input = matchReceiptsSchema.parse(req.body);
      const updated = await SupplierInvoiceService.matchToReceipts(
        String(req.params.id),
        input,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Supplier invoice matched to receipts', updated);
    } catch (err) {
      next(err);
    }
  }

  static async getUnmatchedReceipts(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SupplierInvoiceService.getUnmatchedReceipts();
      sendSuccess(res, 'Unmatched inventory receipts retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getPurchaseRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        supplierId: req.query.supplierId ? String(req.query.supplierId) : undefined,
        factoryId: req.query.factoryId ? String(req.query.factoryId) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        matchingStatus: req.query.matchingStatus ? String(req.query.matchingStatus) : undefined,
        itcStatus: req.query.itcStatus ? String(req.query.itcStatus) : undefined,
        gstin: req.query.gstin ? String(req.query.gstin) : undefined,
        fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
        toDate: req.query.toDate ? String(req.query.toDate) : undefined,
      };

      const format = req.query.format ? String(req.query.format).toLowerCase() : undefined;
      if (format === 'csv' || format === 'excel' || format === 'pdf') {
        const exported = await ComplianceExportService.generatePurchaseRegisterExport(
          format as ExportFormat,
          filters,
        );
        res.setHeader('Content-Type', exported.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
        res.send(exported.buffer);
        return;
      }

      const data = await SupplierInvoiceService.getPurchaseRegister(filters);
      sendSuccess(res, 'Purchase register retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }
}
