import prisma from '../config/prisma.config.js';
import { ApplicationError } from '../utils/ApplicationError.js';
import auditService from './audit.service.js';

export class AdminCustomerService {
  /**
   * Retrieves paginated customer list with search and filter capabilities.
   */
  async listCustomers({
    page = 1,
    limit = 20,
    search,
    status,
    role = 'CUSTOMER',
    isEmailVerified,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where = {};
    if (role) {
      where.role = role.toUpperCase();
    }
    if (status) {
      where.status = status.toUpperCase();
    }
    if (isEmailVerified !== undefined) {
      where.isEmailVerified = isEmailVerified === 'true' || isEmailVerified === true;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const validSortFields = ['createdAt', 'name', 'email', 'lastLoginAt'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const direction = sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [orderField]: direction },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          isEmailVerified: true,
          authProvider: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          orders: {
            where: {
              orderStatus: { not: 'CANCELLED' },
            },
            select: {
              grandTotal: true,
            },
          },
          _count: {
            select: {
              orders: true,
              reviews: true,
              addresses: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const enrichedUsers = users.map((u) => {
      const totalSpend = (u.orders || []).reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
      const { orders, ...rest } = u;
      return {
        ...rest,
        totalSpend: Number(totalSpend.toFixed(2)),
        lifetimeSpend: Number(totalSpend.toFixed(2)),
        ordersCount: u._count?.orders || orders.length || 0,
      };
    });

    return {
      customers: enrichedUsers,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Retrieves comprehensive 360-degree customer profile including order metrics and addresses.
   */
  async getCustomerDetails(customerId) {
    const user = await prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        isEmailVerified: true,
        authProvider: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!user) {
      throw ApplicationError.notFound(`Customer with ID '${customerId}' not found`);
    }

    // Aggregate lifetime financial & order metrics
    const orders = await prisma.order.findMany({
      where: { userId: customerId },
      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        paymentStatus: true,
        paymentMethod: true,
        grandTotal: true,
        placedAt: true,
      },
      orderBy: { placedAt: 'desc' },
    });

    const totalOrders = orders.length;
    const deliveredOrders = orders.filter((o) => o.orderStatus === 'DELIVERED').length;
    const cancelledOrders = orders.filter((o) => o.orderStatus === 'CANCELLED').length;

    // Lifetime spend based on non-cancelled orders
    const nonCancelledOrders = orders.filter((o) => o.orderStatus !== 'CANCELLED');
    const lifetimeSpend = nonCancelledOrders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
    const paidOrders = orders.filter(
      (o) => o.orderStatus !== 'CANCELLED' && (o.paymentStatus === 'CAPTURED' || o.orderStatus === 'DELIVERED')
    );
    const averageOrderValue = nonCancelledOrders.length > 0 ? lifetimeSpend / nonCancelledOrders.length : 0;

    return {
      customer: {
        ...user,
        totalSpend: Number(lifetimeSpend.toFixed(2)),
        lifetimeSpend: Number(lifetimeSpend.toFixed(2)),
        ordersCount: totalOrders,
      },
      metrics: {
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        paidOrdersCount: paidOrders.length,
        lifetimeSpend: Number(lifetimeSpend.toFixed(2)),
        totalSpend: Number(lifetimeSpend.toFixed(2)),
        averageOrderValue: Number(averageOrderValue.toFixed(2)),
      },
      recentOrders: orders.slice(0, 10).map((o) => ({
        ...o,
        totalAmount: Number(o.grandTotal || 0),
        totalPayable: Number(o.grandTotal || 0),
      })),
    };
  }

  /**
   * Updates customer account status (e.g. SUSPENDED, ACTIVE, DEACTIVATED) and revokes sessions if suspended.
   */
  async updateCustomerStatus(customerId, { status, reason }, adminUserId, req) {
    const existing = await prisma.user.findUnique({ where: { id: customerId } });
    if (!existing) {
      throw ApplicationError.notFound(`Customer with ID '${customerId}' not found`);
    }

    if (existing.role === 'ADMIN' && status !== 'ACTIVE') {
      throw ApplicationError.badRequest('Cannot suspend or deactivate an administrator account');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: customerId },
        data: { status },
      });

      // If suspended or deactivated, revoke all active refresh tokens immediately
      if (status === 'SUSPENDED' || status === 'DEACTIVATED') {
        await tx.refreshToken.updateMany({
          where: { userId: customerId, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      await auditService.recordAdminAction({
        adminUserId,
        action: `CUSTOMER_STATUS_${status}`,
        entityType: 'User',
        entityId: customerId,
        details: { previousStatus: existing.status, newStatus: status, reason: reason || null },
        req,
        tx,
      });

      return u;
    });

    return {
      message: `Customer status updated to '${status}' successfully`,
      customer: {
        id: updated.id,
        email: updated.email,
        status: updated.status,
      },
    };
  }

  /**
   * Returns itemized paginated order history for a customer.
   */
  async getCustomerOrderHistory(customerId, { page = 1, limit = 10 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * take;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: customerId },
        skip,
        take,
        orderBy: { placedAt: 'desc' },
        include: {
          items: true,
          addressSnapshot: true,
          payments: { select: { id: true, amount: true, status: true, method: true } },
        },
      }),
      prisma.order.count({ where: { userId: customerId } }),
    ]);

    return {
      orders,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }
}

export const adminCustomerService = new AdminCustomerService();
export default adminCustomerService;
