import { Request, Response } from 'express';
import { sendError } from '../utils/response';

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(
    res,
    `Resource not found - ${req.method} ${req.originalUrl}`,
    { path: req.originalUrl, method: req.method },
    404,
  );
};
