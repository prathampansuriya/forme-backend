import prisma from '../config/prisma.config.js';
import { ApplicationError } from '../utils/ApplicationError.js';
import auditService from './audit.service.js';

export class AdminCommerceService {
  /**
   * Retrieves paginated payment transactions with order context.
   */
  async listPayments({
    page = 1,
    limit = 20,
    status,
    method,
    search,
    startDate,
    endDate,
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where = {};
    if (status) where.status = status;
    if (method) where.method = method;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { razorpayOrderId: { contains: search, mode: 'insensitive' } },
        { razorpayPaymentId: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { order: { user: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderStatus: true,
              grandTotal: true,
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          refunds: true,
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Retrieves a single payment transaction by ID.
   */
  async getPaymentDetails(id) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: true,
            shippingAddress: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        refunds: true,
      },
    });

    if (!payment) {
      throw ApplicationError.notFound(`Payment transaction with ID '${id}' not found`);
    }

    return payment;
  }

  /**
   * Lists all processed or pending refunds.
   */
  async listRefunds({ page = 1, limit = 20, status } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where = {};
    if (status) where.status = status;

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderStatus: true,
              grandTotal: true,
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              method: true,
              razorpayPaymentId: true,
            },
          },
        },
      }),
      prisma.refund.count({ where }),
    ]);

    return {
      refunds,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Moderate review with audit logging.
   */
  async moderateReview(reviewId, isApproved, adminUserId, req) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw ApplicationError.notFound(`Review with ID '${reviewId}' not found`);

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: Boolean(isApproved) },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: isApproved ? 'REVIEW_APPROVED' : 'REVIEW_REJECTED',
      entityType: 'Review',
      entityId: reviewId,
      details: { productId: review.productId, userId: review.userId, isApproved: Boolean(isApproved) },
      req,
    });

    return updated;
  }

  /**
   * Deletes a review with audit logging.
   */
  async deleteReview(reviewId, adminUserId, req) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw ApplicationError.notFound(`Review with ID '${reviewId}' not found`);

    await prisma.review.delete({ where: { id: reviewId } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'REVIEW_DELETED',
      entityType: 'Review',
      entityId: reviewId,
      details: { productId: review.productId, headline: review.headline },
      req,
    });

    return { message: 'Review deleted successfully', id: reviewId };
  }
}

export const adminCommerceService = new AdminCommerceService();
export default adminCommerceService;

