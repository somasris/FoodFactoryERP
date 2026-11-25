import { Request, Response, NextFunction } from 'express';
import { AuditAction } from '@prisma/client';
import { sendSuccess } from '../../utils/response';
import { getAuditMeta, parsePagination } from '../master-data/master-data.utils';
import { UserContext } from '../inventory/inventory.utils';
import { AuditService } from '../../services/audit.service';
import {
  cancelSalesInvoiceSchema,
  createSalesInvoiceSchema,
  updateSalesInvoiceSchema,
} from './sales-invoice.types';
import { SalesInvoiceService } from './sales-invoice.service';
import { SalesInvoicePdfService } from './sales-invoice-pdf.service';

const getUserCtx = (req: Request): UserContext => ({
  userId: req.user!.userId,
  roles: req.user!.roles || [],
});

const getStr = (val: unknown): string | undefined =>
  typeof val === 'string' && val.trim() ? val.trim() : undefined;

export class SalesInvoiceController {
  static async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const data = await SalesInvoiceService.listInvoices(params, getUserCtx(req), {
        status: getStr(req.query.status),
        customerId: getStr(req.query.customerId),
        salesOrderId: getStr(req.query.salesOrderId),
        warehouseId: getStr(req.query.warehouseId),
        fromDate: getStr(req.query.fromDate),
        toDate: getStr(req.query.toDate),
      });
      sendSuccess(res, 'Sales invoices retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async listOrderInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalesInvoiceService.listOrderInvoices(
        String(req.params.orderId),
        getUserCtx(req),
      );
      sendSuccess(res, 'Order invoices retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalesInvoiceService.getInvoiceById(
        String(req.params.id),
        getUserCtx(req),
      );
      sendSuccess(res, 'Sales invoice retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async getInvoiceByNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const invoiceNumber = decodeURIComponent(String(req.params.invoiceNumber));
      const data = await SalesInvoiceService.getInvoiceByNumber(invoiceNumber, getUserCtx(req));
      sendSuccess(res, 'Sales invoice retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async createInvoiceFromOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createSalesInvoiceSchema.parse(req.body || {});
      const data = await SalesInvoiceService.createInvoiceFromOrder(
        String(req.params.orderId),
        validated,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales invoice created successfully', data, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateDraftInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateSalesInvoiceSchema.parse(req.body);
      const data = await SalesInvoiceService.updateDraftInvoice(
        String(req.params.id),
        validated,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales invoice updated successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async issueInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalesInvoiceService.issueInvoice(
        String(req.params.id),
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales invoice issued successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async cancelInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = cancelSalesInvoiceSchema.parse(req.body);
      const data = await SalesInvoiceService.cancelInvoice(
        String(req.params.id),
        reason,
        getUserCtx(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Sales invoice cancelled successfully', data);
    } catch (error) {
      next(error);
    }
  }

  static async downloadInvoicePdf(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await SalesInvoiceService.getInvoiceById(
        String(req.params.id),
        getUserCtx(req),
      );
      const pdfBuffer = await SalesInvoicePdfService.generateInvoicePdf(invoice);

      const meta = getAuditMeta(req);
      await AuditService.log({
        userId: meta.userId,
        action: AuditAction.DOWNLOAD,
        entityType: 'SalesInvoice',
        entityId: invoice.id,
        newState: { invoiceNumber: invoice.invoiceNumber, format: 'PDF' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      const safeFilename = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      res.status(200).send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}
