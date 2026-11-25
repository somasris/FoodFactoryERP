import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { ProductionReportsService } from './production-reports.service';
import { ProductionReportsExportService } from './production-reports-export.service';
import {
  baseReportQuerySchema,
  exportReportParamsSchema,
  exportReportQuerySchema,
  trendsQuerySchema,
} from './production-reports.types';

function hasCostingReportAccess(req: Request): boolean {
  const roles = req.user?.roles || [];
  const perms = req.user?.permissions || [];
  return roles.includes('OWNER') || perms.includes('production.reports.costing.read');
}

export class ProductionReportsController {
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const query = baseReportQuerySchema.parse(req.query);
      const data = await ProductionReportsService.getDashboard(query, hasCostingReportAccess(req));
      sendSuccess(res, 'Production analytics dashboard fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getPlanVsActual(req: Request, res: Response, next: NextFunction) {
    try {
      const query = baseReportQuerySchema.parse(req.query);
      const data = await ProductionReportsService.getPlanVsActualReport(query);
      sendSuccess(res, 'Production plan vs actual report fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getWorkOrderPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const query = baseReportQuerySchema.parse(req.query);
      const data = await ProductionReportsService.getWorkOrderPerformanceReport(query);
      sendSuccess(res, 'Work order performance report fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getBatchYield(req: Request, res: Response, next: NextFunction) {
    try {
      const query = baseReportQuerySchema.parse(req.query);
      const data = await ProductionReportsService.getBatchYieldReport(query);
      sendSuccess(res, 'Batch production and yield report fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getMaterialConsumption(req: Request, res: Response, next: NextFunction) {
    try {
      const query = baseReportQuerySchema.parse(req.query);
      const data = await ProductionReportsService.getMaterialConsumptionReport(query);
      sendSuccess(res, 'Material consumption and wastage report fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getQuality(req: Request, res: Response, next: NextFunction) {
    try {
      const query = baseReportQuerySchema.parse(req.query);
      const data = await ProductionReportsService.getQualityReport(query);
      sendSuccess(res, 'Finished goods and quality report fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getCosting(req: Request, res: Response, next: NextFunction) {
    try {
      const query = baseReportQuerySchema.parse(req.query);
      const data = await ProductionReportsService.getCostingReport(query);
      sendSuccess(res, 'Production cost and variance analytics fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async getTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const query = trendsQuerySchema.parse(req.query);
      const data = await ProductionReportsService.getTrends(query, hasCostingReportAccess(req));
      sendSuccess(res, 'Production trend analytics fetched', data);
    } catch (error) {
      next(error);
    }
  }

  static async exportReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportType } = exportReportParamsSchema.parse(req.params);
      if (reportType === 'costing' && !hasCostingReportAccess(req)) {
        throw new AppError(
          'Forbidden: Missing required permission(s): [production.reports.costing.read]',
          403,
        );
      }
      const query = exportReportQuerySchema.parse(req.query);
      const { buffer, contentType, filename } =
        await ProductionReportsExportService.generateExport(reportType, query.format, query);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }
}
