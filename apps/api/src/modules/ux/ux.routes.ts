import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { UxController } from './ux.controller';

export const preferencesRouter = Router();
preferencesRouter.use(authenticate);
preferencesRouter.get('/', UxController.getPreferences);
preferencesRouter.put('/dashboard', UxController.updateDashboardPreference);
preferencesRouter.delete('/dashboard/:dashboardId', UxController.resetDashboardPreference);
preferencesRouter.put('/tour', UxController.updateTourPreference);

export const savedViewsRouter = Router();
savedViewsRouter.use(authenticate);
savedViewsRouter.get('/', UxController.listSavedViews);
savedViewsRouter.post('/', UxController.createSavedView);
savedViewsRouter.patch('/:id', UxController.updateSavedView);
savedViewsRouter.delete('/:id', UxController.deleteSavedView);

export const activityTimelineRouter = Router();
activityTimelineRouter.use(authenticate);
activityTimelineRouter.get('/', UxController.getActivityTimeline);
