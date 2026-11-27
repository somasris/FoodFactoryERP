import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { parsePagination } from '../master-data/master-data.utils';
import { cancelCreditNoteSchema, createCreditNoteSchema } from './credit-note.types';
import { CreditNoteService } from './credit-note.service';
import { CreditNotePdfService } from './credit-note-pdf.service';

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

export class CreditNoteController {
  static async listCreditNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const params = parsePagination(req.query);
      const data = await CreditNoteService.listCreditNotes(params, getUserContext(req), {
        status: req.query.status ? String(req.query.status) : undefined,
        customerId: req.query.customerId ? String(req.query.customerId) : undefined,
        salesInvoiceId: req.query.salesInvoiceId ? String(req.query.salesInvoiceId) : undefined,
        fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
        toDate: req.query.toDate ? String(req.query.toDate) : undefined,
      });
      sendSuccess(res, 'Credit notes retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getCreditNoteById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CreditNoteService.getCreditNoteById(
        String(req.params.id),
        getUserContext(req),
      );
      sendSuccess(res, 'Credit note retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async createDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createCreditNoteSchema.parse(req.body);
      const created = await CreditNoteService.createDraft(
        input,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Credit note draft created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  static async issueCreditNote(req: Request, res: Response, next: NextFunction) {
    try {
      const issued = await CreditNoteService.issueCreditNote(
        String(req.params.id),
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Credit note issued successfully', issued);
    } catch (err) {
      next(err);
    }
  }

  static async cancelCreditNote(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = cancelCreditNoteSchema.parse(req.body);
      const cancelled = await CreditNoteService.cancelCreditNote(
        String(req.params.id),
        reason,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Credit note cancelled successfully', cancelled);
    } catch (err) {
      next(err);
    }
  }

  static async listInvoiceCreditNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CreditNoteService.listInvoiceCreditNotes(
        String(req.params.id),
        getUserContext(req),
      );
      sendSuccess(res, 'Invoice credit notes retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerCreditBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CreditNoteService.getCustomerCreditBalance(
        String(req.params.customerId),
      );
      sendSuccess(res, 'Customer credit balance retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async downloadCreditNotePdf(req: Request, res: Response, next: NextFunction) {
    try {
      const cn = await CreditNoteService.getCreditNoteById(
        String(req.params.id),
        getUserContext(req),
      );
      const pdfBuffer = await CreditNotePdfService.generateCreditNotePdf(cn);
      const safeName = cn.creditNoteNumber.replace(/[/\\]/g, '-');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="credit-note-${safeName}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}
