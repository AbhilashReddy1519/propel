import { App } from './app.js';
import config from '@config/env.js';
import logger from '@utils/logger.js';
import { startIngestionWorker } from './workers/ingestionWorker.js';
import { startHeartbeatWorker } from './workers/heartbeatWorker.js';

const app = new App().getApp();

const startServer = async () => {
  try {
    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Server running in ${config.env} mode`);
      // logger.info(`Server URL: http://${config.host}:${config.port}`);
      logger.info(`Server URL: http://localhost:${config.port}`);
      logger.info(`Started at: ${new Date().toISOString()}`);
    });

    startIngestionWorker();
    startHeartbeatWorker();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        // await AppDataSource.destroy();
        logger.info('Database connection closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason: Error) => {
      logger.error('Unhandled Rejection:', reason);
      process.exit(1);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
