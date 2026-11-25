import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './services/prisma.service';
import { NotificationSseService } from './modules/notifications/notification-sse.service';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 FoodFactory ERP Backend API listening on port ${env.PORT}`);
  logger.info(`📡 Environment: ${env.NODE_ENV}`);
  logger.info(`🔗 Base URL: http://localhost:${env.PORT}`);
  logger.info(`🩺 Health Endpoint: http://localhost:${env.PORT}/api/v1/health`);
  logger.info(`🗄️ Database Health: http://localhost:${env.PORT}/api/v1/health/database`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`🛑 Received ${signal}. Initiating graceful shutdown...`);
  NotificationSseService.closeAll();

  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await prisma.$disconnect();
      logger.info('Prisma database client disconnected.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during Prisma disconnection:', err);
      process.exit(1);
    }
  });

  // Force shutdown after timeout if not completed cleanly
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection detected:', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception detected:', error);
  process.exit(1);
});
