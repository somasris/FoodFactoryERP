import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { UserContext } from '../inventory/inventory.utils';
import { ShiftHandoverService } from './handover.service';
import { MaterialSubstitutionService } from './substitution.service';
import {
  acknowledgeHandoverSchema,
  applySubstitutionSchema,
  approveSubstitutionSchema,
  createHandoverSchema,
  createSubstitutionRequestSchema,
  evaluateSubstitutionSchema,
  listHandoverQuerySchema,
  rejectSubstitutionSchema,
  returnHandoverSchema,
  updateHandoverSchema,
} from './collaboration.types';

function toUserContext(req: Request): UserContext {
  return { userId: req.user!.userId, roles: req.user!.roles };
}

function toMeta(req: Request) {
  return {
    userId: req.user!.userId,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

export class CollaborationController {
  static async handoverDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const factoryId = typeof req.query.factoryId === 'string' ? req.query.factoryId : undefined;
      const data = await ShiftHandoverService.getDashboard(toUserContext(req), factoryId);
      sendSuccess(res, 'Shift handover dashboard retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async listHandovers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listHandoverQuerySchema.parse(req.query);
      const data = await ShiftHandoverService.list(toUserContext(req), query);
      sendSuccess(res, 'Shift handovers retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async getHandover(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ShiftHandoverService.getById(toUserContext(req), String(req.params.id));
      sendSuccess(res, 'Shift handover retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async createHandover(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createHandoverSchema.parse(req.body);
      const data = await ShiftHandoverService.create(toUserContext(req), input, toMeta(req));
      sendSuccess(res, 'Shift handover created', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateHandover(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateHandoverSchema.parse(req.body);
      const data = await ShiftHandoverService.update(
        toUserContext(req),
        String(req.params.id),
        input,
        toMeta(req),
      );
      sendSuccess(res, 'Shift handover updated', data);
    } catch (err) {
      next(err);
    }
  }

  static async submitHandover(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ShiftHandoverService.submit(
        toUserContext(req),
        String(req.params.id),
        toMeta(req),
      );
      sendSuccess(res, 'Shift handover submitted', data);
    } catch (err) {
      next(err);
    }
  }

  static async acknowledgeHandover(req: Request, res: Response, next: NextFunction) {
    try {
      const input = acknowledgeHandoverSchema.parse(req.body ?? {});
      const data = await ShiftHandoverService.acknowledge(
        toUserContext(req),
        String(req.params.id),
        input.acknowledgementNotes,
        toMeta(req),
      );
      sendSuccess(res, 'Shift handover acknowledged', data);
    } catch (err) {
      next(err);
    }
  }

  static async returnHandover(req: Request, res: Response, next: NextFunction) {
    try {
      const input = returnHandoverSchema.parse(req.body);
      const data = await ShiftHandoverService.returnForCorrection(
        toUserContext(req),
        String(req.params.id),
        input.returnReason,
        toMeta(req),
      );
      sendSuccess(res, 'Shift handover returned for correction', data);
    } catch (err) {
      next(err);
    }
  }

  static async closeHandover(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ShiftHandoverService.close(
        toUserContext(req),
        String(req.params.id),
        toMeta(req),
      );
      sendSuccess(res, 'Shift handover closed', data);
    } catch (err) {
      next(err);
    }
  }

  static async evaluateSubstitution(req: Request, res: Response, next: NextFunction) {
    try {
      const input = evaluateSubstitutionSchema.parse(req.body);
      const data = await MaterialSubstitutionService.evaluate(toUserContext(req), input);
      sendSuccess(res, 'Material substitution evaluated', data);
    } catch (err) {
      next(err);
    }
  }

  static async listSubstitutions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await MaterialSubstitutionService.listRequests(toUserContext(req));
      sendSuccess(res, 'Material substitution requests retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  static async createSubstitution(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createSubstitutionRequestSchema.parse(req.body);
      const data = await MaterialSubstitutionService.createRequest(
        toUserContext(req),
        input,
        toMeta(req),
      );
      sendSuccess(res, 'Material substitution request created', data, 201);
    } catch (err) {
      next(err);
    }
  }

  static async approveSubstitution(req: Request, res: Response, next: NextFunction) {
    try {
      const input = approveSubstitutionSchema.parse(req.body ?? {});
      const data = await MaterialSubstitutionService.approveRequest(
        toUserContext(req),
        String(req.params.id),
        input.approvalNotes,
        toMeta(req),
      );
      sendSuccess(res, 'Material substitution request approved', data);
    } catch (err) {
      next(err);
    }
  }

  static async rejectSubstitution(req: Request, res: Response, next: NextFunction) {
    try {
      const input = rejectSubstitutionSchema.parse(req.body);
      const data = await MaterialSubstitutionService.rejectRequest(
        toUserContext(req),
        String(req.params.id),
        input.rejectionReason,
        toMeta(req),
      );
      sendSuccess(res, 'Material substitution request rejected', data);
    } catch (err) {
      next(err);
    }
  }

  static async applySubstitution(req: Request, res: Response, next: NextFunction) {
    try {
      const input = applySubstitutionSchema.parse(req.body ?? {});
      const data = await MaterialSubstitutionService.applyRequest(
        toUserContext(req),
        String(req.params.id),
        input.applicationNotes,
        toMeta(req),
      );
      sendSuccess(res, 'Material substitution applied', data);
    } catch (err) {
      next(err);
    }
  }
}
