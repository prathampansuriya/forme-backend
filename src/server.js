import app from './app.js';
import env from './config/env.config.js';
import prisma from './config/prisma.config.js';
import { logger } from './config/logger.config.js';
import os from 'os';

const PORT = env.PORT || 5000;

// Connect to Database & Start Server
const startServer = async () => {
  try {
    // Verify database connectivity
    await prisma.$connect();
    logger.info('Connected successfully to PostgreSQL database via Prisma');

    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`FORME API Server running on port ${PORT} [${env.NODE_ENV}]`);
      logger.info(`Local:    http://localhost:${PORT}/api/v1/health`);

      // LAN IP ડાયનેમિક રીતે મેળવો
      const interfaces = os.networkInterfaces();
      Object.values(interfaces)
        .flat()
        .filter((i) => i && i.family === 'IPv4' && !i.internal)
        .forEach((i) => {
          logger.info(`Network:  http://${i.address}:${PORT}/api/v1/health`);
        });
    });

    // Graceful Shutdown Handlers
    const handleShutdown = async (signal) => {
      logger.info(`Received ${signal}. Initiating graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await prisma.$disconnect();
          logger.info('Prisma disconnected from PostgreSQL.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during database disconnect:', err);
          process.exit(1);
        }
      });

      // Force exit after 10s if graceful shutdown hangs
      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing process termination.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to initialize server or connect to database:', error);
    process.exit(1);
  }
};

// Global Uncaught Exception Handlers
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception occurred:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
  process.exit(1);
});

startServer();
