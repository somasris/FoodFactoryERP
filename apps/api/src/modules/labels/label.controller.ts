import { Request, Response, NextFunction } from 'express';
import { getAuditMeta } from '../master-data/master-data.utils';
import { SyncUserContext } from '../sync/sync.service';
import { LabelTemplateService } from './label-template.service';
import { BatchLabelService } from './batch-label.service';
import {
  createLabelTemplateSchema,
  generateBatchLabelSchema,
  reprintBatchLabelSchema,
  updateLabelTemplateSchema,
} from './label.types';
import { z } from 'zod';

const previewSchema = z.object({
  productionBatchId: z.string().uuid(),
  templateId: z.string().uuid(),
  labelMode: z.enum(['RELEASED', 'INTERNAL_STATUS']).default('RELEASED'),
  storageInstructionsOverride: z.string().trim().max(255).optional(),
});

function getUserContext(req: Request): SyncUserContext {
  return {
    userId: req.user!.userId,
    username: req.user!.username ?? req.user!.email,
    roles: req.user!.roles,
    permissions: req.user!.permissions ?? [],
  };
}

function getQrBaseUrl(req: Request): string {
  const origin = req.get('origin');
  if (origin) return origin;
  return `${req.protocol}://${req.get('host')}`;
}

export class LabelController {
  static async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const data = await LabelTemplateService.listTemplates(req.user!.userId, includeInactive);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createLabelTemplateSchema.parse(req.body);
      const data = await LabelTemplateService.createTemplate(payload, req.user!.userId, getAuditMeta(req));
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = updateLabelTemplateSchema.parse(req.body);
      const data = await LabelTemplateService.updateTemplate(
        String(req.params.id),
        payload,
        req.user!.userId,
        getAuditMeta(req),
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async duplicateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await LabelTemplateService.duplicateTemplate(
        String(req.params.id),
        req.user!.userId,
        getAuditMeta(req),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async toggleTemplateActive(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive = Boolean(req.body?.isActive);
      const data = await LabelTemplateService.setTemplateActive(
        String(req.params.id),
        isActive,
        req.user!.userId,
        getAuditMeta(req),
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async previewLabel(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = previewSchema.parse(req.body);
      const result = await BatchLabelService.buildAuthoritativePreview(
        payload,
        getUserContext(req),
        getAuditMeta(req),
      );
      res.status(200).json({ success: true, data: result.snapshot });
    } catch (err) {
      next(err);
    }
  }

  static async generateLabel(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = generateBatchLabelSchema.parse(req.body);
      const data = await BatchLabelService.generateLabel(
        payload,
        getUserContext(req),
        getAuditMeta(req),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async reprintLabel(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = reprintBatchLabelSchema.parse(req.body);
      const data = await BatchLabelService.reprintLabel(
        String(req.params.id),
        payload,
        getUserContext(req),
        getAuditMeta(req),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async listHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await BatchLabelService.listHistory(
        {
          productionBatchId: req.query.productionBatchId ? String(req.query.productionBatchId) : undefined,
          generationType: req.query.generationType ? String(req.query.generationType) : undefined,
        },
        getUserContext(req),
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async downloadPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, labelNumber } = await BatchLabelService.renderRecordPdf(
        String(req.params.id),
        getUserContext(req),
        getQrBaseUrl(req),
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${labelNumber}.pdf"`);
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }
}
