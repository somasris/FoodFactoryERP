import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { GovernanceService } from './governance.service';

export class GovernanceController {
  static async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await GovernanceService.listAuditLogs({
        search: req.query.search ? String(req.query.search) : undefined,
        entityType: req.query.entityType ? String(req.query.entityType) : undefined,
        entityId: req.query.entityId ? String(req.query.entityId) : undefined,
        userId: req.query.userId ? String(req.query.userId) : undefined,
        action: req.query.action ? String(req.query.action) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 25, 100),
      });
      sendSuccess(res, 'Audit logs retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getAuditLogById(req: Request, res: Response, next: NextFunction) {
    try {
      const log = await GovernanceService.getAuditLogById(String(req.params.id));
      sendSuccess(res, 'Audit log entry retrieved successfully', log);
    } catch (err) {
      next(err);
    }
  }

  static async exportAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await GovernanceService.exportAuditLogsCsv({
        entityType: req.query.entityType ? String(req.query.entityType) : undefined,
        action: req.query.action ? String(req.query.action) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        page: 1,
        limit: 500,
      });
      const dateStamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="Audit_Trail_${dateStamp}.csv"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  static async getApprovals(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await GovernanceService.getApprovalHistory({
        status: req.query.status ? String(req.query.status) : undefined,
        module: req.query.module ? String(req.query.module) : undefined,
      });
      sendSuccess(res, 'Approval governance history retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getUserActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await GovernanceService.getUserActivityLogs({
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 25, 100),
        action: req.query.action ? String(req.query.action) : undefined,
      });
      sendSuccess(res, 'User activity monitoring logs retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getTransactionHistory(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await GovernanceService.getUnifiedTransactionHistory();
      sendSuccess(res, 'Unified transaction history retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }
}
