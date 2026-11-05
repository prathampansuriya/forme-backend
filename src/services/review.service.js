import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import { logger } from '../config/logger.config.js';

class ReviewService {
  /**
   * Checks if a customer has purchased a specific product in a completed or valid order.
   */
  async checkCustomerPurchase(userId, productId) {
    if (!userId || !productId) return false;

    const purchaseItem = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          OR: [
            { paymentStatus: { in: ['CAPTURED', 'AUTHORIZED'] } },
            { orderStatus: { in: ['DELIVERED', 'SHIPPED', 'CONFIRMED', 'PLACED', 'PROCESSING'] } },
          ],
        },
      },
      select: { id: true },
    });

    return Boolean(purchaseItem);
  }

  /**
   * Evaluates whether a customer can review and checks existing review status.
   */
  async checkEligibility(userId, productId) {
    if (!userId) {
      return { isEligible: false, hasPurchased: false, canReview: false, existingReview: null };
    }

    const [hasPurchased, existingReview] = await Promise.all([
      this.checkCustomerPurchase(userId, productId),
      prisma.review.findFirst({
        where: { userId, productId },
      }),
    ]);

    return {
      hasPurchased,
      isVerifiedPurchaseEligible: hasPurchased,
      canReview: !existingReview,
      existingReview,
    };
  }

  /**
   * Submits a customer review with verified purchase verification and optional media.
   */
  async submitReview({
    userId,
    productId,
    rating,
    headline = null,
    content,
    media = [],
    verifiedOnly = false,
  }) {
    if (!userId) {
      throw ApplicationError.unauthorized('Authentication required to submit a review.');
    }

    // 1. Validate Product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, status: true },
    });

    if (!product || product.status !== 'PUBLISHED') {
      throw ApplicationError.notFound('Product not found or unavailable for review.', 'PRODUCT_NOT_FOUND');
    }

    // 2. Prevent duplicate reviews
    const existing = await prisma.review.findFirst({
      where: { userId, productId },
    });

    if (existing) {
      throw ApplicationError.conflict(
        'You have already submitted an editorial review for this garment. You may edit your existing review.',
        'REVIEW_ALREADY_EXISTS'
      );
    }

    // 3. Verified Purchase Cross-Check
    const hasPurchased = await this.checkCustomerPurchase(userId, productId);

    if (verifiedOnly && !hasPurchased) {
      throw ApplicationError.forbidden(
        'Only customers who have acquired and verified this piece may submit a review.',
        'NOT_ELIGIBLE_TO_REVIEW'
      );
    }

    const isVerifiedPurchase = hasPurchased;

    // 4. Create Review and Media in a transaction
    return prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          productId,
          userId,
          rating,
          headline: headline ? headline.trim() : null,
          content: content.trim(),
          isVerifiedPurchase,
          isApproved: true, // Default active; subject to post-moderation
        },
      });

      if (media && media.length > 0) {
        await tx.reviewMedia.createMany({
          data: media.map((m, index) => ({
            reviewId: review.id,
            mediaType: m.mediaType || 'IMAGE',
            publicId: m.publicId,
            url: m.url,
            displayOrder: m.displayOrder !== undefined ? m.displayOrder : index,
          })),
        });
      }

      return tx.review.findUnique({
        where: { id: review.id },
        include: {
          media: {
            orderBy: { displayOrder: 'asc' },
          },
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
    });
  }

  /**
   * Updates an existing review. Author or Admin permitted.
   */
  async updateReview(id, userId, userRole, data) {
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw ApplicationError.notFound('Review not found.', 'REVIEW_NOT_FOUND');
    }

    const isAuthor = review.userId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

    if (!isAuthor && !isAdmin) {
      throw ApplicationError.forbidden('You do not have permission to modify this review.', 'FORBIDDEN_RESOURCE');
    }

    return prisma.$transaction(async (tx) => {
      if (data.media !== undefined) {
        // Replace media if provided
        await tx.reviewMedia.deleteMany({ where: { reviewId: id } });
        if (data.media.length > 0) {
          await tx.reviewMedia.createMany({
            data: data.media.map((m, index) => ({
              reviewId: id,
              mediaType: m.mediaType || 'IMAGE',
              publicId: m.publicId,
              url: m.url,
              displayOrder: m.displayOrder !== undefined ? m.displayOrder : index,
            })),
          });
        }
      }

      return tx.review.update({
        where: { id },
        data: {
          ...(data.rating !== undefined && { rating: data.rating }),
          ...(data.headline !== undefined && { headline: data.headline ? data.headline.trim() : null }),
          ...(data.content !== undefined && { content: data.content.trim() }),
        },
        include: {
          media: {
            orderBy: { displayOrder: 'asc' },
          },
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
    });
  }

  /**
   * Deletes a review. Author can delete their own; Admin can delete any.
   */
  async deleteReview(id, userId, userRole) {
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw ApplicationError.notFound('Review not found.', 'REVIEW_NOT_FOUND');
    }

    const isAuthor = review.userId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

    if (!isAuthor && !isAdmin) {
      throw ApplicationError.forbidden('You do not have permission to delete this review.', 'FORBIDDEN_RESOURCE');
    }

    await prisma.review.delete({
      where: { id },
    });

    return { success: true, message: 'Review removed successfully.' };
  }

  /**
   * Public retrieval of approved reviews for a specific garment with pagination.
   */
  async getProductReviews({ productId, page = 1, limit = 10, sort = 'recent' }) {
    const where = {
      productId,
      isApproved: true,
    };

    let orderBy = [{ createdAt: 'desc' }];
    if (sort === 'highest') orderBy = [{ rating: 'desc' }, { createdAt: 'desc' }];
    if (sort === 'lowest') orderBy = [{ rating: 'asc' }, { createdAt: 'desc' }];

    const skip = (page - 1) * limit;

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          media: { orderBy: { displayOrder: 'asc' } },
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Computes authoritative rating distribution and review statistics for a garment.
   */
  async getProductReviewStats(productId) {
    const reviews = await prisma.review.findMany({
      where: {
        productId,
        isApproved: true,
      },
      select: {
        rating: true,
        isVerifiedPurchase: true,
      },
    });

    const totalReviews = reviews.length;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;
    let verifiedPurchaseCount = 0;

    for (const r of reviews) {
      if (ratingDistribution[r.rating] !== undefined) {
        ratingDistribution[r.rating] += 1;
      }
      ratingSum += r.rating;
      if (r.isVerifiedPurchase) {
        verifiedPurchaseCount += 1;
      }
    }

    const averageRating = totalReviews > 0 ? parseFloat((ratingSum / totalReviews).toFixed(1)) : 0;

    return {
      productId,
      totalReviews,
      averageRating,
      verifiedPurchaseCount,
      ratingDistribution,
    };
  }

  /**
   * Retrieves all reviews submitted by a specific patron.
   */
  async getMyReviews(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where: { userId } }),
      prisma.review.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              baseSku: true,
              media: {
                take: 1,
                orderBy: { sortOrder: 'asc' },
                select: { url: true, alt: true },
              },
            },
          },
          media: true,
        },
      }),
    ]);

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Lists all customer reviews with moderation filters.
   */
  async listReviewsAdmin({ page = 1, limit = 20, status = 'all' } = {}) {
    const where = {};
    if (status === 'approved') where.isApproved = true;
    if (status === 'pending' || status === 'hidden') where.isApproved = false;

    const skip = (page - 1) * limit;

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, slug: true, baseSku: true } },
          user: { select: { id: true, name: true, email: true } },
          media: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Admin: Approves or hides a customer review.
   */
  async moderateReview(id, isApproved) {
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw ApplicationError.notFound('Review not found.', 'REVIEW_NOT_FOUND');
    }

    return prisma.review.update({
      where: { id },
      data: { isApproved: Boolean(isApproved) },
      include: {
        product: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Admin: Overall review analytics summary across all garments.
   */
  async getAdminReviewSummary() {
    const allReviews = await prisma.review.findMany({
      select: { rating: true, isApproved: true, isVerifiedPurchase: true },
    });

    const total = allReviews.length;
    let approvedCount = 0;
    let pendingCount = 0;
    let totalScore = 0;
    const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const r of allReviews) {
      if (r.isApproved) approvedCount++;
      else pendingCount++;
      totalScore += r.rating;
      if (starCounts[r.rating] !== undefined) {
        starCounts[r.rating]++;
      }
    }

    const averageRating = total > 0 ? parseFloat((totalScore / total).toFixed(1)) : 0;

    return {
      totalReviews: total,
      approvedCount,
      pendingCount,
      averageRating,
      starCounts,
    };
  }
}

export default new ReviewService();

