import prisma from '../config/db.js';
import ApplicationError from '../utils/ApplicationError.js';
import pricingService from './pricing.service.js';
import { round2, toDecimal, calcPercentage, minDecimal, sub } from '../utils/pricingMath.js';
import { FlashSaleStatus, DiscountType, Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

class FlashSaleService {
  /**
   * Get active flash sales with live countdown and promotional product snapshots.
   */
  async getActiveFlashSales(now = new Date()) {
    // Automatically transition expired flash sales in background
    await this.syncExpiredSales(now);

    const flashSales = await prisma.flashSale.findMany({
      where: {
        status: FlashSaleStatus.ACTIVE,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      include: {
        products: {
          include: {
            product: {
              include: {
                media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 5 },
                category: true,
                variants: {
                  include: {
                    media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 },
                  },
                  take: 10,
                },
              },
            },
            variant: {
              include: {
                media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { priority: 'desc' },
    });

    return flashSales.map((fs) => this._formatFlashSaleWithCountdown(fs, now));
  }

  /**
   * Get detailed flash sale by slug or ID.
   */
  async getFlashSaleBySlug(identifier, now = new Date()) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const flashSale = await prisma.flashSale.findFirst({
      where: isUuid ? { id: identifier } : { slug: identifier },
      include: {
        products: {
          include: {
            product: {
              include: {
                media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 5 },
                category: true,
                variants: {
                  include: {
                    media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 },
                  },
                },
              },
            },
            variant: {
              include: {
                media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!flashSale) {
      throw ApplicationError.notFound(`Flash sale "${identifier}" not found`);
    }

    return this._formatFlashSaleWithCountdown(flashSale, now);
  }

  async getFlashSaleByIdOrSlug(identifier, now = new Date()) {
    return this.getFlashSaleBySlug(identifier, now);
  }

  /**
   * Helper: Formats flash sale with live countdown time and pricing calculation.
   * @private
   */
  _formatFlashSaleWithCountdown(fs, now = new Date()) {
    const start = new Date(fs.startTime);
    const end = new Date(fs.endTime);
    const nowMs = now.getTime();
    const endMs = end.getTime();
    const startMs = start.getTime();

    const isUpcoming = nowMs < startMs;
    const isExpired = nowMs > endMs;
    const isActive = !isUpcoming && !isExpired && fs.status === FlashSaleStatus.ACTIVE;

    const remainingSeconds = isActive ? Math.max(0, Math.floor((endMs - nowMs) / 1000)) : 0;
    const remainingHours = Math.floor(remainingSeconds / 3600);
    const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);

    const formattedProducts = (fs.products || []).map((fsp) => {
      const product = fsp.product;
      const variant = fsp.variant;

      // Base price
      const baseSellingPrice = variant?.priceOverride != null
        ? toDecimal(variant.priceOverride)
        : toDecimal(product.sellingPrice);

      const compareAtPrice = variant?.compareAtPriceOverride != null
        ? toDecimal(variant.compareAtPriceOverride)
        : (product.compareAtPrice ? toDecimal(product.compareAtPrice) : baseSellingPrice);

      // Flash discount
      let discountAmount = new Decimal(0);
      if (fsp.discountType === DiscountType.PERCENTAGE) {
        discountAmount = calcPercentage(baseSellingPrice, fsp.discountValue);
      } else {
        discountAmount = minDecimal(toDecimal(fsp.discountValue), baseSellingPrice);
      }

      const flashPrice = sub(baseSellingPrice, discountAmount);
      const stockLimit = fsp.stockLimit;
      const soldCount = fsp.soldCount;
      const stockRemaining = stockLimit > 0 ? Math.max(0, stockLimit - soldCount) : null;
      const isSoldOut = stockLimit > 0 && stockRemaining === 0;

      const primaryMedia =
        variant?.media?.[0] ||
        product?.media?.find((m) => m.isPrimary) ||
        product?.media?.[0];
      const primaryImageUrl =
        primaryMedia?.secureUrl ||
        primaryMedia?.thumbnailUrl ||
        primaryMedia?.url ||
        null;

      return {
        flashSaleProductId: fsp.id,
        productId: product.id,
        variantId: variant?.id || null,
        productName: product.name,
        productSlug: product.slug,
        categoryName: product.category?.name,
        primaryImage: primaryImageUrl,
        media: (product.media || []).map((m) => ({
          ...m,
          url: m.secureUrl || m.thumbnailUrl || m.url,
          secureUrl: m.secureUrl || m.url,
        })),
        compareAtPrice: round2(compareAtPrice),
        baseSellingPrice: round2(baseSellingPrice),
        flashPrice: round2(flashPrice),
        discountType: fsp.discountType,
        discountValue: fsp.discountValue,
        discountAmount: round2(discountAmount),
        stockLimit,
        soldCount,
        stockRemaining,
        isSoldOut,
      };
    });

    return {
      id: fs.id,
      name: fs.name,
      slug: fs.slug,
      description: fs.description,
      status: fs.status,
      priority: fs.priority,
      displaySettings: fs.displaySettings,
      startTime: fs.startTime,
      endTime: fs.endTime,
      countdown: {
        isActive,
        isUpcoming,
        isExpired,
        remainingSeconds,
        remainingHours,
        remainingMinutes,
        endsAt: fs.endTime,
      },
      productsCount: formattedProducts.length,
      products: formattedProducts,
    };
  }

  /**
   * Sync expired flash sales to EXPIRED status in database.
   */
  async syncExpiredSales(now = new Date()) {
    try {
      await prisma.flashSale.updateMany({
        where: {
          status: FlashSaleStatus.ACTIVE,
          endTime: { lt: now },
        },
        data: { status: FlashSaleStatus.EXPIRED },
      });
    } catch {
      // Non-fatal background sync
    }
  }

  /**
   * Admin: List all flash sales.
   */
  async listFlashSales({ page = 1, limit = 20, status = null, search = '' } = {}) {
    const skip = (page - 1) * limit;
    const where = {};

    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, flashSales] = await Promise.all([
      prisma.flashSale.count({ where }),
      prisma.flashSale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
        include: {
          _count: { select: { products: true } },
        },
      }),
    ]);

    const now = new Date();
    return {
      flashSales: flashSales.map((fs) => this._formatFlashSaleWithCountdown(fs, now)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Admin: Create a new flash sale drop.
   */
  async createFlashSale(data) {
    const { name, slug, description, startTime, endTime, priority = 0, products = [] } = data;

    const existingSlug = await prisma.flashSale.findUnique({ where: { slug } });
    if (existingSlug) {
      throw ApplicationError.conflict(`Flash sale slug "${slug}" is already in use`);
    }

    return prisma.$transaction(async (tx) => {
      const flashSale = await tx.flashSale.create({
        data: {
          name,
          slug,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: FlashSaleStatus.ACTIVE,
          priority: parseInt(priority, 10) || 0,
        },
      });

      if (products.length > 0) {
        await tx.flashSaleProduct.createMany({
          data: products.map((p, idx) => ({
            flashSaleId: flashSale.id,
            productId: p.productId,
            variantId: p.variantId || null,
            discountType: p.discountType || DiscountType.PERCENTAGE,
            discountValue: toDecimal(p.discountValue),
            stockLimit: parseInt(p.stockLimit, 10) || 0,
            displayOrder: idx,
          })),
        });
      }

      return flashSale;
    });
  }

  /**
   * Admin: Update flash sale.
   */
  async updateFlashSale(id, data) {
    const existing = await prisma.flashSale.findUnique({ where: { id } });
    if (!existing) {
      throw ApplicationError.notFound(`Flash sale "${id}" not found`);
    }

    const { startTime, endTime, ...rest } = data;
    const updatePayload = { ...rest };
    if (startTime) updatePayload.startTime = new Date(startTime);
    if (endTime) updatePayload.endTime = new Date(endTime);

    return prisma.flashSale.update({
      where: { id },
      data: updatePayload,
    });
  }

  /**
   * Admin: Add products to flash sale.
   */
  async addProductsToFlashSale(flashSaleId, products = []) {
    const flashSale = await prisma.flashSale.findUnique({ where: { id: flashSaleId } });
    if (!flashSale) {
      throw ApplicationError.notFound(`Flash sale "${flashSaleId}" not found`);
    }

    return prisma.$transaction(async (tx) => {
      for (const p of products) {
        await tx.flashSaleProduct.upsert({
          where: {
            flashSaleId_productId_variantId: {
              flashSaleId,
              productId: p.productId,
              variantId: p.variantId || null,
            },
          },
          update: {
            discountType: p.discountType,
            discountValue: toDecimal(p.discountValue),
            stockLimit: p.stockLimit || 0,
          },
          create: {
            flashSaleId,
            productId: p.productId,
            variantId: p.variantId || null,
            discountType: p.discountType || DiscountType.PERCENTAGE,
            discountValue: toDecimal(p.discountValue),
            stockLimit: p.stockLimit || 0,
          },
        });
      }

      return tx.flashSale.findUnique({
        where: { id: flashSaleId },
        include: { products: true },
      });
    });
  }

  /**
   * Admin: Remove product from flash sale.
   */
  async removeProductFromFlashSale(flashSaleId, productId, variantId = null) {
    await prisma.flashSaleProduct.deleteMany({
      where: {
        flashSaleId,
        productId,
        variantId: variantId || null,
      },
    });

    return { message: 'Product removed from flash sale' };
  }

  /**
   * Admin: Cancel or delete flash sale.
   */
  async deleteFlashSale(id) {
    const existing = await prisma.flashSale.findUnique({ where: { id } });
    if (!existing) {
      throw ApplicationError.notFound(`Flash sale "${id}" not found`);
    }

    await prisma.flashSale.delete({ where: { id } });
    return { id, message: 'Flash sale deleted successfully' };
  }
}

export default new FlashSaleService();

