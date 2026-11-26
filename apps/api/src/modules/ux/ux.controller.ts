import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { UxService } from './ux.service';
import {
  activityTimelineQuerySchema,
  createSavedViewSchema,
  dashboardPreferenceSchema,
  tourPreferenceSchema,
  updateSavedViewSchema,
} from './ux.types';

export class UxController {
  static async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await UxService.getPreferences(req.user!.userId);
      sendSuccess(res, 'User preferences retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async updateDashboardPreference(req: Request, res: Response, next: NextFunction) {
    try {
      const input = dashboardPreferenceSchema.parse(req.body);
      const data = await UxService.updateDashboardPreference(req.user!.userId, input);
      sendSuccess(res, 'Dashboard preferences saved', data);
    } catch (err) {
      next(err);
    }
  }

  static async resetDashboardPreference(req: Request, res: Response, next: NextFunction) {
    try {
      const dashboardId = String(req.params.dashboardId);
      const data = await UxService.resetDashboardPreference(req.user!.userId, dashboardId);
      sendSuccess(res, 'Dashboard preferences reset to default', data);
    } catch (err) {
      next(err);
    }
  }

  static async updateTourPreference(req: Request, res: Response, next: NextFunction) {
    try {
      const input = tourPreferenceSchema.parse(req.body);
      const data = await UxService.updateTourPreference(req.user!.userId, input.completed);
      sendSuccess(res, 'Product tour preference updated', data);
    } catch (err) {
      next(err);
    }
  }

  static async listSavedViews(req: Request, res: Response, next: NextFunction) {
    try {
      const module = typeof req.query.module === 'string' ? req.query.module : undefined;
      const views = await UxService.listSavedViews(req.user!, module);
      sendSuccess(res, 'Saved views retrieved successfully', views);
    } catch (err) {
      next(err);
    }
  }

  static async createSavedView(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createSavedViewSchema.parse(req.body);
      const view = await UxService.createSavedView(req.user!, input);
      sendSuccess(res, 'Saved view created successfully', view, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateSavedView(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateSavedViewSchema.parse(req.body);
      const view = await UxService.updateSavedView(req.user!, String(req.params.id), input);
      sendSuccess(res, 'Saved view updated successfully', view);
    } catch (err) {
      next(err);
    }
  }

  static async deleteSavedView(req: Request, res: Response, next: NextFunction) {
    try {
      await UxService.deleteSavedView(req.user!, String(req.params.id));
      sendSuccess(res, 'Saved view deleted successfully', null);
    } catch (err) {
      next(err);
    }
  }

  static async getActivityTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const query = activityTimelineQuerySchema.parse(req.query);
      const data = await UxService.getActivityTimeline(req.user!, query);
      sendSuccess(res, 'Activity timeline retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }
}
