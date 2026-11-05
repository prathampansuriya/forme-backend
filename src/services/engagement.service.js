import prisma from '../config/prisma.config.js';
import { logger } from '../config/logger.config.js';

class EngagementService {
  /**
   * Records a product view event and persists to recently viewed history.
   */
  async recordProductView({ productId, userId = null, sessionId = null }) {
    if (!productId) return null;

    try {
      // 1. Increment product view count in PostgreSQL
      await prisma.product.update({
        where: { id: productId },
        data: {
          viewCount: { increment: 1 },
        },
      });

      // 2. Track in RecentlyViewedProduct if user or session is present
      if (userId || sessionId) {
        // Upsert / Refresh view timestamp
        const existing = await prisma.recentlyViewedProduct.findFirst({
          where: {
            productId,
            ...(userId ? { userId } : { sessionId }),
          },
        });

        if (existing) {
          await prisma.recentlyViewedProduct.update({
            where: { id: existing.id },
            data: { viewedAt: new Date() },
          });
        } else {
          await prisma.recentlyViewedProduct.create({
            data: {
              productId,
              userId,
              sessionId,
              viewedAt: new Date(),
            },
          });
        }
      }

      return { success: true };
    } catch (error) {
      logger.warn(`[ENGAGEMENT] Failed to track product view for ${productId}:`, error.message);
      return null;
    }
  }

  /**
   * Tracks cart addition event.
   */
  async recordCartAddition({ productId, variantId, quantity = 1, userId = null, sessionId = null }) {
    logger.info(`[ENGAGEMENT] Cart addition: product=${productId}, variant=${variantId}, qty=${quantity}, user=${userId || sessionId}`);
    return { success: true };
  }

  /**
   * Tracks wishlist addition event.
   */
  async recordWishlistAddition({ productId, userId }) {
    logger.info(`[ENGAGEMENT] Wishlist addition: product=${productId}, user=${userId}`);
    return { success: true };
  }

  /**
   * Records real sales on product entities when an order is finalized.
   */
  async recordPurchase({ items = [] }) {
    if (!items || items.length === 0) return;

    try {
      for (const item of items) {
        if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              salesCount: { increment: item.quantity || 1 },
            },
          });
        }
      }
    } catch (error) {
      logger.error('[ENGAGEMENT] Failed to increment sales counts:', error);
    }
  }

  /**
   * Records search activity in SearchQueryLog.
   */
  async recordSearchQuery({ query, resultsCount = 0 }) {
    if (!query || !query.trim()) return null;
    const normalized = query.trim().toLowerCase();

    try {
      const log = await prisma.searchQueryLog.upsert({
        where: { query: normalized },
        update: {
          count: { increment: 1 },
          resultsCount,
        },
        create: {
          query: normalized,
          count: 1,
          resultsCount,
        },
      });
      return log;
    } catch (error) {
      logger.warn(`[ENGAGEMENT] Failed to log search query "${normalized}":`, error.message);
      return null;
    }
  }

  /**
   * Returns recently viewed products for a customer or anonymous session.
   */
  async getRecentlyViewed({ userId = null, sessionId = null, limit = 8 }) {
    if (!userId && !sessionId) return [];

    const history = await prisma.recentlyViewedProduct.findMany({
      where: {
        ...(userId ? { userId } : { sessionId }),
      },
      orderBy: { viewedAt: 'desc' },
      take: limit * 2,
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            media: {
              orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
              take: 2,
            },
            variants: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                size: true,
                colorName: true,
                colorHex: true,
                priceOverride: true,
                availableQuantity: true,
              },
            },
          },
        },
      },
    });

    // Deduplicate by productId preserving latest view order
    const seen = new Set();
    const products = [];

    for (const record of history) {
      if (record.product && !seen.has(record.product.id) && record.product.status === 'PUBLISHED') {
        seen.add(record.product.id);
        products.push(record.product);
        if (products.length >= limit) break;
      }
    }

    return products;
  }

  /**
   * Computes genuine trending products based on combined engagement signals.
   * Trending Score = viewCount * 1 + wishlistCount * 3 + cartCount * 5 + salesCount * 10
   */
  async getTrendingMetrics({ limit = 8 } = {}) {
    const products = await prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        name: true,
        slug: true,
        viewCount: true,
        salesCount: true,
        _count: {
          select: {
            wishlistItems: true,
          },
        },
      },
      orderBy: [
        { salesCount: 'desc' },
        { viewCount: 'desc' },
      ],
      take: limit * 3,
    });

    // Calculate score
    const scored = products.map((p) => {
      const score = (p.viewCount * 1) + (p._count.wishlistItems * 3) + (p.salesCount * 10);
      return { ...p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }
}

export default new EngagementService();

