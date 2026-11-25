import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { analyticsFilterSchema } from './reports.types';
import { ReportsService } from './reports.service';
import {
  AnalyticsExportType,
  ExportFormat,
  ReportsExportService,
} from './reports-export.service';

const getUserContext = (req: Request) => {
  if (!req.user) throw new AppError('Authentication required.', 401);
  return {
    userId: req.user.userId,
    username: req.user.username,
    roles: req.user.roles || [],
  };
};

export class ReportsController {
  static async executiveDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = analyticsFilterSchema.parse(req.query);
      const data = await ReportsService.getExecutiveDashboard(filter);
      sendSuccess(res, 'Executive dashboard KPIs retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async salesAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = analyticsFilterSchema.parse(req.query);
      const data = await ReportsService.getSalesAnalytics(filter);
      sendSuccess(res, 'Sales analytics retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async inventoryAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = analyticsFilterSchema.parse(req.query);
      const data = await ReportsService.getInventoryAnalytics(filter, getUserContext(req));
      sendSuccess(res, 'Inventory analytics retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async productionAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = analyticsFilterSchema.parse(req.query);
      const data = await ReportsService.getProductionAnalytics(filter);
      sendSuccess(res, 'Production analytics retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async profitability(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = analyticsFilterSchema.parse(req.query);
      const data = await ReportsService.getProfitabilityReport(filter);
      sendSuccess(res, 'Profitability and gross margin report retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async factoryPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = analyticsFilterSchema.parse(req.query);
      const data = await ReportsService.getFactoryPerformance(filter, getUserContext(req));
      sendSuccess(res, 'Factory performance dashboard retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async exportAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const reportType = String(req.params.reportType) as AnalyticsExportType;
      const valid: AnalyticsExportType[] = [
        'sales',
        'inventory',
        'profitability',
        'factory-performance',
      ];
      if (!valid.includes(reportType)) {
        throw new AppError(`Invalid analytics export type: ${reportType}`, 400);
      }

      const format = (req.query.format ? String(req.query.format) : 'csv') as ExportFormat;
      if (!['csv', 'excel', 'pdf'].includes(format)) {
        throw new AppError('Invalid export format. Use csv, excel, or pdf.', 400);
      }

      const filter = analyticsFilterSchema.parse(req.query);
      const result = await ReportsExportService.generateExport(
        reportType,
        format,
        filter,
        getUserContext(req),
      );

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  }
}
