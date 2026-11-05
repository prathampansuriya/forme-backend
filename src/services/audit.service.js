import prisma from '../config/prisma.config.js';
import { logger } from '../config/logger.config.js';

export class AuditService {
  /**
   * Records an administrative action to the AdminAuditLog table.
   *
   * @param {Object} params
   * @param {string} params.adminUserId - User ID of the administrator
   * @param {string} params.action - Action identifier (e.g. PRODUCT_CREATED, SETTING_UPDATED)
   * @param {string} params.entityType - Target entity name (e.g. Product, Order, Customer, CMS)
   * @param {string} [params.entityId] - ID of the target record
   * @param {Object} [params.details] - Arbitrary JSON metadata describing the mutation
   * @param {import('express').Request} [params.req] - Express request object for deriving IP/UA
   * @param {string} [params.ipAddress] - Optional override IP
   * @param {string} [params.userAgent] - Optional override User Agent
   * @param {Object} [params.tx] - Optional Prisma transaction client
   */
  async recordAdminAction({
    adminUserId,
    action,
    entityType,
    entityId = null,
    details = null,
    req = null,
    ipAddress = null,
    userAgent = null,
    tx = null,
  }) {
    try {
      const client = tx || prisma;

      // Extract network context if request is provided
      const resolvedIp =
        ipAddress ||
        (req ? req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip : null);
      const resolvedUa = userAgent || (req ? req.headers['user-agent'] : null);

      return await client.adminAuditLog.create({
        data: {
          adminUserId,
          action,
          entityType,
          entityId: entityId ? String(entityId) : null,
          details: details ? (typeof details === 'object' ? details : { raw: details }) : null,
          ipAddress: resolvedIp ? String(resolvedIp).substring(0, 45) : null,
          userAgent: resolvedUa ? String(resolvedUa).substring(0, 500) : null,
        },
      });
    } catch (error) {
      logger.error(`[AUDIT_LOG_ERROR] Failed to record audit log for action ${action}:`, error);
      // In non-transactional contexts, do not fail parent workflow solely due to logging error
      if (tx) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Retrieves paginated audit logs with search, entity filters, and date range.
   */
  async listAuditLogs({
    page = 1,
    limit = 20,
    adminUserId,
    entityType,
    action,
    startDate,
    endDate,
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where = {};

    if (adminUserId) {
      where.adminUserId = adminUserId;
    }

    if (entityType) {
      where.entityType = { equals: entityType, mode: 'insensitive' };
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Retrieves single audit record with admin details.
   */
  async getAuditLogById(id) {
    return prisma.adminAuditLog.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }
}

export const auditService = new AuditService();
export default auditService;

