import prisma from '../config/db.js';
import ApplicationError from '../utils/ApplicationError.js';
import { round2, toDecimal } from '../utils/pricingMath.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

class OfferService {
  /**
   * List active promotional offers for customer discovery.
   */
  async listActiveOffers(now = new Date()) {
    const offers = await prisma.offer.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        applicableProducts: { include: { product: { select: { id: true, name: true, slug: true } } } },
        applicableCategories: { include: { category: { select: { id: true, name: true, slug: true } } } },
        applicableCollections: { include: { collection: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return offers.map((o) => ({
      ...o,
      discountValue: round2(o.discountValue),
      maxDiscountAmount: o.maxDiscountAmount ? round2(o.maxDiscountAmount) : null,
      minPurchaseAmount: round2(o.minPurchaseAmount),
    }));
  }

  /**
   * Get offer by slug.
   */
  async getOfferBySlug(slug) {
    const offer = await prisma.offer.findUnique({
      where: { slug },
      include: {
        applicableProducts: { include: { product: true } },
        applicableCategories: { include: { category: true } },
        applicableCollections: { include: { collection: true } },
      },
    });

    if (!offer) {
      throw ApplicationError.notFound(`Offer "${slug}" not found`);
    }

    return {
      ...offer,
      title: offer.name,
      discountValue: round2(offer.discountValue),
      maxDiscountAmount: offer.maxDiscountAmount ? round2(offer.maxDiscountAmount) : null,
      maxDiscount: offer.maxDiscountAmount ? round2(offer.maxDiscountAmount) : null,
      minPurchaseAmount: round2(offer.minPurchaseAmount),
      isStackable: offer.allowStacking,
      productIds: (offer.applicableProducts || []).map((ap) => ap.productId),
      categoryIds: (offer.applicableCategories || []).map((ac) => ac.categoryId),
      collectionIds: (offer.applicableCollections || []).map((ac) => ac.collectionId),
      offerProducts: (offer.applicableProducts || []).map((ap) => ({ productId: ap.productId })),
      offerCategories: (offer.applicableCategories || []).map((ac) => ({ categoryId: ac.categoryId })),
      offerCollections: (offer.applicableCollections || []).map((ac) => ({ collectionId: ac.collectionId })),
    };
  }

  /**
   * Get offer by ID.
   */
  async getOfferById(id) {
    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        applicableProducts: { include: { product: true } },
        applicableCategories: { include: { category: true } },
        applicableCollections: { include: { collection: true } },
      },
    });

    if (!offer) {
      throw ApplicationError.notFound(`Offer "${id}" not found`);
    }

    const productIds = (offer.applicableProducts || []).map((ap) => ap.productId);
    const categoryIds = (offer.applicableCategories || []).map((ac) => ac.categoryId);
    const collectionIds = (offer.applicableCollections || []).map((ac) => ac.collectionId);

    return {
      ...offer,
      title: offer.name,
      discountValue: round2(offer.discountValue),
      maxDiscountAmount: offer.maxDiscountAmount ? round2(offer.maxDiscountAmount) : null,
      maxDiscount: offer.maxDiscountAmount ? round2(offer.maxDiscountAmount) : null,
      minPurchaseAmount: round2(offer.minPurchaseAmount),
      isStackable: offer.allowStacking,
      productIds,
      categoryIds,
      collectionIds,
      offerProducts: productIds.map((productId) => ({ productId })),
      offerCategories: categoryIds.map((categoryId) => ({ categoryId })),
      offerCollections: collectionIds.map((collectionId) => ({ collectionId })),
    };
  }

  /**
   * Admin: List offers with pagination and filters.
   */
  async listOffers({ page = 1, limit = 20, search = '', isActive = null } = {}) {
    const skip = (page - 1) * limit;
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === true || isActive === 'true';
    }

    const [total, offers] = await Promise.all([
      prisma.offer.count({ where }),
      prisma.offer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          applicableProducts: { select: { productId: true } },
          applicableCategories: { select: { categoryId: true } },
          applicableCollections: { select: { collectionId: true } },
          _count: {
            select: {
              applicableProducts: true,
              applicableCategories: true,
              applicableCollections: true,
              usages: true,
            },
          },
        },
      }),
    ]);

    return {
      offers: offers.map((o) => {
        const productIds = (o.applicableProducts || []).map((ap) => ap.productId);
        const categoryIds = (o.applicableCategories || []).map((ac) => ac.categoryId);
        const collectionIds = (o.applicableCollections || []).map((ac) => ac.collectionId);

        return {
          ...o,
          title: o.name,
          discountValue: round2(o.discountValue),
          maxDiscountAmount: o.maxDiscountAmount ? round2(o.maxDiscountAmount) : null,
          maxDiscount: o.maxDiscountAmount ? round2(o.maxDiscountAmount) : null,
          minPurchaseAmount: round2(o.minPurchaseAmount),
          isStackable: o.allowStacking,
          productIds,
          categoryIds,
          collectionIds,
          offerProducts: productIds.map((productId) => ({ productId })),
          offerCategories: categoryIds.map((categoryId) => ({ categoryId })),
          offerCollections: collectionIds.map((collectionId) => ({ collectionId })),
        };
      }),
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
   * Admin: Create a new offer.
   */
  async createOffer(data) {
    const {
      name,
      title,
      slug,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      maxDiscount,
      minPurchaseAmount,
      startDate,
      endDate,
      isActive = true,
      allowStacking = false,
      isStackable,
      productIds = [],
      categoryIds = [],
      collectionIds = [],
    } = data;

    const resolvedName = name || title;
    const resolvedAllowStacking = allowStacking ?? isStackable ?? false;
    const resolvedMaxDiscount = maxDiscountAmount != null ? toDecimal(maxDiscountAmount) : maxDiscount != null ? toDecimal(maxDiscount) : null;
    const resolvedEndDate = endDate ? new Date(endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const existing = await prisma.offer.findUnique({ where: { slug } });
    if (existing) {
      throw ApplicationError.conflict(`Offer slug "${slug}" already exists`);
    }

    return prisma.offer.create({
      data: {
        name: resolvedName,
        slug,
        description,
        discountType,
        discountValue: toDecimal(discountValue),
        maxDiscountAmount: resolvedMaxDiscount,
        minPurchaseAmount: minPurchaseAmount != null ? toDecimal(minPurchaseAmount) : new Decimal(0),
        startDate: new Date(startDate || Date.now()),
        endDate: resolvedEndDate,
        isActive,
        allowStacking: resolvedAllowStacking,
        applicableProducts: productIds.length > 0 ? {
          create: productIds.map((productId) => ({ productId })),
        } : undefined,
        applicableCategories: categoryIds.length > 0 ? {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        } : undefined,
        applicableCollections: collectionIds.length > 0 ? {
          create: collectionIds.map((collectionId) => ({ collectionId })),
        } : undefined,
      },
      include: {
        applicableProducts: true,
        applicableCategories: true,
        applicableCollections: true,
      },
    });
  }

  /**
   * Admin: Update offer.
   */
  async updateOffer(id, data) {
    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) {
      throw ApplicationError.notFound(`Offer "${id}" not found`);
    }

    const {
      productIds,
      categoryIds,
      collectionIds,
      startDate,
      endDate,
      discountValue,
      maxDiscountAmount,
      maxDiscount,
      minPurchaseAmount,
      name,
      title,
      allowStacking,
      isStackable,
      ...rest
    } = data;

    const updatePayload = { ...rest };
    if (name || title) updatePayload.name = name || title;
    if (allowStacking !== undefined || isStackable !== undefined) {
      updatePayload.allowStacking = allowStacking ?? isStackable;
    }
    if (startDate) updatePayload.startDate = new Date(startDate);
    if (endDate) updatePayload.endDate = new Date(endDate);
    if (discountValue != null) updatePayload.discountValue = toDecimal(discountValue);
    if (maxDiscountAmount !== undefined || maxDiscount !== undefined) {
      const val = maxDiscountAmount ?? maxDiscount;
      updatePayload.maxDiscountAmount = val != null ? toDecimal(val) : null;
    }
    if (minPurchaseAmount != null) updatePayload.minPurchaseAmount = toDecimal(minPurchaseAmount);

    return prisma.$transaction(async (tx) => {
      if (Array.isArray(productIds)) {
        await tx.offerProduct.deleteMany({ where: { offerId: id } });
        if (productIds.length > 0) {
          await tx.offerProduct.createMany({
            data: productIds.map((productId) => ({ offerId: id, productId })),
          });
        }
      }

      if (Array.isArray(categoryIds)) {
        await tx.offerCategory.deleteMany({ where: { offerId: id } });
        if (categoryIds.length > 0) {
          await tx.offerCategory.createMany({
            data: categoryIds.map((categoryId) => ({ offerId: id, categoryId })),
          });
        }
      }

      if (Array.isArray(collectionIds)) {
        await tx.offerCollection.deleteMany({ where: { offerId: id } });
        if (collectionIds.length > 0) {
          await tx.offerCollection.createMany({
            data: collectionIds.map((collectionId) => ({ offerId: id, collectionId })),
          });
        }
      }

      return tx.offer.update({
        where: { id },
        data: updatePayload,
        include: {
          applicableProducts: true,
          applicableCategories: true,
          applicableCollections: true,
        },
      });
    });
  }

  /**
   * Admin: Delete offer.
   */
  async deleteOffer(id) {
    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) {
      throw ApplicationError.notFound(`Offer "${id}" not found`);
    }

    await prisma.offer.delete({ where: { id } });
    return { id, message: 'Offer deleted successfully' };
  }
}

export default new OfferService();

