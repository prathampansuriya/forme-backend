import prisma from '../config/prisma.config.js';
import env from '../config/env.config.js';

export class HealthService {
  async checkHealth() {
    const startTime = Date.now();
    let dbStatus = 'disconnected';
    let dbLatencyMs = null;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
      dbLatencyMs = Date.now() - startTime;
    } catch (error) {
      dbStatus = 'error';
      console.error('[HEALTH SERVICE] Database ping failed:', error.message);
    }

    const memoryUsage = process.memoryUsage();

    return {
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      service: 'FORME API',
      version: '1.0.0',
      tagline: 'Designed to Be Worn. Made to Be Remembered.',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      system: {
        nodeVersion: process.version,
        memory: {
          heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
          rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        },
      },
    };
  }

  async checkLiveness() {
    return {
      status: 'live',
      timestamp: new Date().toISOString(),
    };
  }

  async checkReadiness() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'not_ready',
        database: 'unreachable',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const healthService = new HealthService();
export default healthService;

