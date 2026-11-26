import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { SearchController } from './search.controller';

export const searchRouter: Router = Router();

searchRouter.use(authenticate);
searchRouter.get('/', SearchController.search);
