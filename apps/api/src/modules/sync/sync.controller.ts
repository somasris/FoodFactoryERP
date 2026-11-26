import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { AuditMeta } from '../master-data/master-data.utils';
import { SyncService, SyncUserContext } from './sync.service';
import { pullQuerySchema, pushBatchSchema, resolveConflictSchema } from './sync.types';

function getUserContext(req: Request): SyncUserContext {
  if (!req.user) {
    throw new AppError('Unauthenticated request.', 401);
  }
  return {
    userId: req.user.userId,
    username: req.user.username,
    roles: req.user.roles,
    permissions: req.user.permissions,
  };
}

function getAuditMeta(req: Request): AuditMeta {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

export class SyncController {
  static async status(req: Request, res: Response) {
    const data = await SyncService.getStatus(getUserContext(req));
    return sendSuccess(res, 'Sync status retrieved successfully', data);
  }

  static async push(req: Request, res: Response) {
    const parsed = pushBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid sync push payload.', 400, parsed.error.flatten());
    }
    const data = await SyncService.pushBatch(
      getUserContext(req),
      parsed.data.operations,
      getAuditMeta(req),
    );
    return sendSuccess(res, 'Sync push batch processed', data);
  }

  static async pull(req: Request, res: Response) {
    const parsed = pullQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError('Invalid sync pull parameters.', 400, parsed.error.flatten());
    }
    const data = await SyncService.pullChanges(getUserContext(req), parsed.data);
    return sendSuccess(res, 'Sync pull changes retrieved', data);
  }

  static async getOperation(req: Request, res: Response) {
    const user = getUserContext(req);
    const data = await SyncService.getOperationStatus(user.userId, String(req.params.operationId));
    return sendSuccess(res, 'Sync operation retrieved', data);
  }

  static async listConflicts(req: Request, res: Response) {
    const user = getUserContext(req);
    const data = await SyncService.listConflicts(user.userId);
    return sendSuccess(res, 'Sync conflicts retrieved', data);
  }

  static async resolveConflict(req: Request, res: Response) {
    const parsed = resolveConflictSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid conflict resolution action.', 400, parsed.error.flatten());
    }
    const data = await SyncService.resolveConflict(
      getUserContext(req),
      String(req.params.conflictId),
      parsed.data.action,
    );
    return sendSuccess(res, 'Sync conflict resolved', data);
  }
}
