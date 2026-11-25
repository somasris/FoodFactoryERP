import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import {
  createComplianceDocSchema,
  createStockAuditSchema,
  dateRangeQuerySchema,
  postStockAuditSchema,
  reviewStockAuditSchema,
  verifyComplianceDocSchema,
} from './compliance.types';
import { GstComplianceService } from './gst-compliance.service';
import { StockAuditService } from './stock-audit.service';
import { ComplianceReportsService } from './compliance-reports.service';
import {
  ComplianceExportService,
  ComplianceExportType,
  ExportFormat,
} from './compliance-export.service';

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

export class ComplianceController {
  // 4.2.1 & 4.2.2 GST & Purchase Tax Summaries
  static async getGstSalesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const query = dateRangeQuerySchema.parse(req.query);
      const data = await GstComplianceService.getGstSalesSummary(query);
      sendSuccess(res, 'GST sales compliance summary retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getPurchaseTaxSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await GstComplianceService.getPurchaseTaxSummary();
      sendSuccess(res, 'Purchase tax availability summary retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  // 4.2.3 Inventory Valuation & Stock Audits
  static async getInventoryValuation(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
      const data = await StockAuditService.getInventoryValuationReport(getUserContext(req), {
        warehouseId,
      });
      sendSuccess(res, 'Inventory valuation compliance report retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async listStockAudits(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await StockAuditService.listStockAudits(getUserContext(req), {
        warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 20, 100),
      });
      sendSuccess(res, 'Stock audits retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getStockAuditById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await StockAuditService.getStockAuditById(
        String(req.params.id),
        getUserContext(req),
      );
      sendSuccess(res, 'Stock audit retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async createStockAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createStockAuditSchema.parse(req.body);
      const created = await StockAuditService.createStockAudit(
        input,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Stock audit session created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  static async submitStockAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await StockAuditService.submitStockAudit(
        String(req.params.id),
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Stock audit submitted for review', updated);
    } catch (err) {
      next(err);
    }
  }

  static async reviewStockAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const input = reviewStockAuditSchema.parse(req.body);
      const updated = await StockAuditService.reviewStockAudit(
        String(req.params.id),
        input,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, `Stock audit ${input.decision.toLowerCase()}`, updated);
    } catch (err) {
      next(err);
    }
  }

  static async postStockAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const { idempotencyKey } = postStockAuditSchema.parse(req.body || {});
      const posted = await StockAuditService.postStockAuditAdjustment(
        String(req.params.id),
        idempotencyKey,
        getUserContext(req),
        getAuditMeta(req),
      );
      sendSuccess(res, 'Stock audit adjustments posted to inventory ledger', posted);
    } catch (err) {
      next(err);
    }
  }

  // 4.2.4 Production Cost Compliance
  static async getProductionCostCompliance(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ComplianceReportsService.getProductionCostCompliance({
        status: req.query.status ? String(req.query.status) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      });
      sendSuccess(res, 'Production cost compliance report retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  // 4.2.5 Traceability & Exports
  static async getTraceabilityReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ComplianceReportsService.getTraceabilityReport({
        batchNumber: req.query.batchNumber ? String(req.query.batchNumber) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
      });
      sendSuccess(res, 'Batch traceability compliance report retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async exportReport(req: Request, res: Response, next: NextFunction) {
    try {
      const reportType = String(req.params.reportType) as ComplianceExportType;
      const validTypes: ComplianceExportType[] = [
        'gst-sales',
        'hsn-summary',
        'inventory-valuation',
        'production-costing',
        'traceability',
      ];
      if (!validTypes.includes(reportType)) {
        throw new AppError(`Invalid compliance export report type: ${reportType}`, 400);
      }

      const format = (req.query.format ? String(req.query.format) : 'csv') as ExportFormat;
      if (!['csv', 'excel', 'pdf'].includes(format)) {
        throw new AppError('Invalid export format. Use csv, excel, or pdf.', 400);
      }

      const query = dateRangeQuerySchema.parse(req.query);
      const result = await ComplianceExportService.generateExport(
        reportType,
        format,
        query,
        getUserContext(req),
      );

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  }

  // 4.2.6 Compliance Documents
  static async listDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const docs = await ComplianceReportsService.listDocuments({
        category: req.query.category ? String(req.query.category) : undefined,
        verificationStatus: req.query.verificationStatus
          ? String(req.query.verificationStatus)
          : undefined,
      });
      sendSuccess(res, 'Compliance documents retrieved successfully', docs);
    } catch (err) {
      next(err);
    }
  }

  static async createDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createComplianceDocSchema.parse(req.body);
      const user = getUserContext(req);
      const doc = await ComplianceReportsService.createDocument(
        input,
        user.userId,
        getAuditMeta(req),
      );
      sendSuccess(res, 'Compliance document metadata registered successfully', doc, 201);
    } catch (err) {
      next(err);
    }
  }

  static async verifyDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const input = verifyComplianceDocSchema.parse(req.body);
      const user = getUserContext(req);
      const updated = await ComplianceReportsService.verifyDocument(
        String(req.params.id),
        input,
        user.userId,
        getAuditMeta(req),
      );
      sendSuccess(res, `Compliance document marked ${input.status}`, updated);
    } catch (err) {
      next(err);
    }
  }
}
