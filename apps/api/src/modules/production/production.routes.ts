import { Router } from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth.middleware';
import { bomsRouter } from '../master-data/boms/boms.routes';
import { ProductionPlanController } from './production-plan.controller';
import { WorkOrderController } from './work-order.controller';

export const productionRouter: Router = Router();

productionRouter.use(authenticate);

// Phase 3.1: BOM & Recipes
productionRouter.use('/boms', bomsRouter);

// Phase 3.2: Production Planning & Demand
productionRouter.get(
  '/planning/dashboard',
  requirePermissions('production.plans.read'),
  ProductionPlanController.getDashboard,
);
productionRouter.get(
  '/demand',
  requirePermissions('production.demand.read'),
  ProductionPlanController.getDemand,
);
productionRouter.get(
  '/plans',
  requirePermissions('production.plans.read'),
  ProductionPlanController.listPlans,
);
productionRouter.get(
  '/plans/:id',
  requirePermissions('production.plans.read'),
  ProductionPlanController.getPlanById,
);
productionRouter.get(
  '/plans/:id/material-availability',
  requirePermissions('production.plans.read'),
  ProductionPlanController.getMaterialAvailability,
);
productionRouter.post(
  '/plans',
  requirePermissions('production.plans.create'),
  ProductionPlanController.createPlan,
);
productionRouter.patch(
  '/plans/:id',
  requirePermissions('production.plans.update'),
  ProductionPlanController.updatePlan,
);
productionRouter.post(
  '/plans/:id/submit',
  requirePermissions('production.plans.submit'),
  ProductionPlanController.submitPlan,
);
productionRouter.post(
  '/plans/:id/approve',
  requirePermissions('production.plans.approve'),
  ProductionPlanController.approvePlan,
);
productionRouter.post(
  '/plans/:id/reject',
  requirePermissions('production.plans.approve'),
  ProductionPlanController.rejectPlan,
);
productionRouter.post(
  '/plans/:id/release',
  requirePermissions('production.plans.release'),
  ProductionPlanController.releasePlan,
);
productionRouter.post(
  '/plans/:id/cancel',
  requirePermissions('production.plans.cancel'),
  ProductionPlanController.cancelPlan,
);

// Phase 3.3: Work Order Management
productionRouter.get(
  '/work-orders/dashboard',
  requirePermissions('production.work_orders.read'),
  WorkOrderController.getDashboard,
);
productionRouter.get(
  '/work-orders',
  requirePermissions('production.work_orders.read'),
  WorkOrderController.listWorkOrders,
);
productionRouter.get(
  '/work-orders/:id',
  requirePermissions('production.work_orders.read'),
  WorkOrderController.getWorkOrderById,
);
productionRouter.get(
  '/work-orders/:id/material-requirements',
  requirePermissions('production.work_orders.read'),
  WorkOrderController.getMaterialRequirements,
);
productionRouter.post(
  '/work-orders',
  requirePermissions('production.work_orders.create'),
  WorkOrderController.createWorkOrder,
);
productionRouter.patch(
  '/work-orders/:id',
  requirePermissions('production.work_orders.update'),
  WorkOrderController.updateWorkOrder,
);
productionRouter.post(
  '/work-orders/:id/submit',
  requirePermissions('production.work_orders.submit'),
  WorkOrderController.submitWorkOrder,
);
productionRouter.post(
  '/work-orders/:id/approve',
  requirePermissions('production.work_orders.approve'),
  WorkOrderController.approveWorkOrder,
);
productionRouter.post(
  '/work-orders/:id/reject',
  requirePermissions('production.work_orders.approve'),
  WorkOrderController.rejectWorkOrder,
);
productionRouter.post(
  '/work-orders/:id/release',
  requirePermissions('production.work_orders.release'),
  WorkOrderController.releaseWorkOrder,
);
productionRouter.post(
  '/work-orders/:id/cancel',
  requirePermissions('production.work_orders.cancel'),
  WorkOrderController.cancelWorkOrder,
);
