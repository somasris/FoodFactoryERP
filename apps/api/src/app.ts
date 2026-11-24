import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/logger.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';
import { errorHandler, AppError } from './middleware/error.middleware';
import { apiRouter } from './routes';
import { sendSuccess } from './utils/response';

export const createApp = (): Express => {
  const app = express();

  // Explicit CORS allowlist - credentials mode NEVER uses wildcard origins
  const allowedOrigins = [env.FRONTEND_URL];

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!requestOrigin) return callback(null, true);
        if (allowedOrigins.includes(requestOrigin)) {
          return callback(null, true);
        }
        return callback(
          new AppError(`Forbidden: Cross-origin request blocked by CSRF policy (${requestOrigin}).`, 403),
        );
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }),
  );

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Root welcoming endpoint
  app.get('/', (_req, res) => {
    sendSuccess(res, 'FoodFactory ERP API Server Root', {
      application: 'FoodFactory ERP API',
      version: '1.0.0',
      phase: '1.3 Hardened Authentication & RBAC',
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
