import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { LabelController } from './label.controller';

export const labelRouter: Router = Router();

labelRouter.use(authenticate);

// Label templates
labelRouter.get('/templates', requirePermissions('production.batches.read'), LabelController.listTemplates);
labelRouter.post('/templates', requirePermissions('production.batches.create'), LabelController.createTemplate);
labelRouter.patch('/templates/:id', requirePermissions('production.batches.create'), LabelController.updateTemplate);
labelRouter.post('/templates/:id/duplicate', requirePermissions('production.batches.create'), LabelController.duplicateTemplate);
labelRouter.post('/templates/:id/status', requirePermissions('production.batches.create'), LabelController.toggleTemplateActive);

// Batch label preview, generation, reprint, history, PDF
labelRouter.post('/preview', requirePermissions('production.batches.read'), LabelController.previewLabel);
labelRouter.post('/generate', requirePermissions('production.batches.create'), LabelController.generateLabel);
labelRouter.post('/:id/reprint', requirePermissions('production.batches.create'), LabelController.reprintLabel);
labelRouter.get('/history', requirePermissions('production.batches.read'), LabelController.listHistory);
labelRouter.get('/:id/pdf', requirePermissions('production.batches.read'), LabelController.downloadPdf);
