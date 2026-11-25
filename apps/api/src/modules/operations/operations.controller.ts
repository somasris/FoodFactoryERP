import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { OperationsService } from './operations.service';

const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().min(5).max(300).optional(),
});

const restoreRequestSchema = z.object({
  backupRecordId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

const reviewRestoreSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().max(500).optional(),
});

const getActor = (req: Request) => {
  if (!req.user) throw new AppError('Authentication required.', 401);
  return {
    userId: req.user.userId,
    username: req.user.username,
    roles: req.user.roles || [],
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
};

export class OperationsController {
  static async getHealth(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await OperationsService.getDetailedHealth();
      sendSuccess(res, 'Detailed system health retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getMonitoring(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = getActor(req);
      const data = await OperationsService.getMonitoring(actor.roles);
      sendSuccess(res, 'Monitoring metrics and redacted errors retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getDatabaseInfo(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await OperationsService.getDatabaseMaintenanceInfo();
      sendSuccess(res, 'Database maintenance visibility retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async listBackups(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await OperationsService.listBackups();
      sendSuccess(res, 'Backup and restore history retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async triggerBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await OperationsService.triggerBackup(getActor(req));
      sendSuccess(res, 'Backup execution processed', record, 201);
    } catch (err) {
      next(err);
    }
  }

  static async verifyBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await OperationsService.verifyBackup(String(req.params.id));
      sendSuccess(res, 'Backup verification completed', record);
    } catch (err) {
      next(err);
    }
  }

  static async requestRestore(req: Request, res: Response, next: NextFunction) {
    try {
      const input = restoreRequestSchema.parse(req.body);
      const created = await OperationsService.requestRestore(
        input.backupRecordId,
        input.notes,
        getActor(req),
      );
      sendSuccess(res, 'Controlled restore request submitted', created, 201);
    } catch (err) {
      next(err);
    }
  }

  static async reviewRestore(req: Request, res: Response, next: NextFunction) {
    try {
      const input = reviewRestoreSchema.parse(req.body);
      const updated = await OperationsService.reviewRestoreRequest(
        String(req.params.id),
        input.decision,
        input.reason,
        getActor(req),
      );
      sendSuccess(res, `Restore request ${input.decision.toLowerCase()}`, updated);
    } catch (err) {
      next(err);
    }
  }

  static async getMaintenanceMode(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await OperationsService.getMaintenanceMode();
      sendSuccess(res, 'Maintenance mode status retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async setMaintenanceMode(req: Request, res: Response, next: NextFunction) {
    try {
      const input = maintenanceSchema.parse(req.body);
      const data = await OperationsService.setMaintenanceMode(
        input.enabled,
        input.message,
        getActor(req),
      );
      sendSuccess(res, `Maintenance mode ${input.enabled ? 'enabled' : 'disabled'}`, data);
    } catch (err) {
      next(err);
    }
  }
}
