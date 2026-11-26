import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { CollaborationController } from './collaboration.controller';

export const collaborationRouter = Router();

collaborationRouter.use(authenticate);

// 1. Digital Shift Handover
collaborationRouter.get(
  '/handovers/dashboard',
  requirePermissions('production.batches.read'),
  CollaborationController.handoverDashboard,
);
collaborationRouter.get(
  '/handovers',
  requirePermissions('production.batches.read'),
  CollaborationController.listHandovers,
);
collaborationRouter.get(
  '/handovers/:id',
  requirePermissions('production.batches.read'),
  CollaborationController.getHandover,
);
collaborationRouter.post(
  '/handovers',
  requirePermissions('production.batches.execute'),
  CollaborationController.createHandover,
);
collaborationRouter.patch(
  '/handovers/:id',
  requirePermissions('production.batches.execute'),
  CollaborationController.updateHandover,
);
collaborationRouter.post(
  '/handovers/:id/submit',
  requirePermissions('production.batches.execute'),
  CollaborationController.submitHandover,
);
collaborationRouter.post(
  '/handovers/:id/acknowledge',
  requirePermissions('production.batches.execute'),
  CollaborationController.acknowledgeHandover,
);
collaborationRouter.post(
  '/handovers/:id/return',
  requirePermissions('production.batches.execute'),
  CollaborationController.returnHandover,
);
collaborationRouter.post(
  '/handovers/:id/close',
  requirePermissions('production.batches.execute'),
  CollaborationController.closeHandover,
);

// 2. Material Substitution Checker & Controlled Approval
collaborationRouter.post(
  '/substitutions/evaluate',
  requirePermissions('production.batches.read'),
  CollaborationController.evaluateSubstitution,
);
collaborationRouter.get(
  '/substitutions',
  requirePermissions('production.batches.read'),
  CollaborationController.listSubstitutions,
);
collaborationRouter.post(
  '/substitutions',
  requirePermissions('production.batches.execute'),
  CollaborationController.createSubstitution,
);
collaborationRouter.post(
  '/substitutions/:id/approve',
  requirePermissions('production.work_orders.approve'),
  CollaborationController.approveSubstitution,
);
collaborationRouter.post(
  '/substitutions/:id/reject',
  requirePermissions('production.work_orders.approve'),
  CollaborationController.rejectSubstitution,
);
collaborationRouter.post(
  '/substitutions/:id/apply',
  requirePermissions('production.batches.execute'),
  CollaborationController.applySubstitution,
);
