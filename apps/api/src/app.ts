import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requestLogger } from './middleware/logger.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';
import { errorHandler } from './middleware/error.middleware';
import { apiRouter } from './routes';
import { sendSuccess } from './utils/response';

export const createApp = (): Express => {
  const app = express();

  // Middleware setup
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Root welcoming endpoint
  app.get('/', (_req, res) => {
    sendSuccess(res, 'FoodFactory ERP API Server Root', {
      application: 'FoodFactory ERP API',
      version: '1.0.0',
      phase: '1.1 Foundation',
      documentation: '/api/v1/health',
    });
  });

  // REST API v1 routing
  app.use('/api/v1', apiRouter);

  // 404 catch-all handler
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
};
