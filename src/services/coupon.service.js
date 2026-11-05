import prisma from '../config/db.js';
import ApplicationError from '../utils/ApplicationError.js';
import pricingService from './pricing.service.js';
import { round2, toDecimal } from '../utils/pricingMath.js';

class CouponService {
  /**
   * Validate a coupon against current bag items and customer identity.
   */
  async validateCoupon({ code, items = [], customerId = null, stateCode = null }) {
    if (!code || !code.trim()) {
      throw ApplicationError.badRequest('Coupon code is required', 'VALIDATION_ERROR');
    }

    const normalizedCode = code.trim().toUpperCase();

    // Authoritative calculation via Pricing Engine
    const breakdown = await pricingService.calculateCartPricing({
      items,
      couponCode: normalizedCode,
      customerId,
      stateCode,
    });

    if (!breakdown.appliedCoupon) {
      throw ApplicationError.badRequest(`Coupon "${normalizedCode}" could not be applied`, 'INVALID_COUPON');
    }

    return {
      isValid: true,
      coupon: breakdown.appliedCoupon,
      discountAmount: breakdown.couponDiscount,
      breakdown,
    };
  }

  /**
   * Get coupons applicable to current bag.
   */
  async getApplicableCoupons({ items = [], customerId = null }) {
    return pricingService.getApplicableCoupons({ items, customerId });
  }

  /**
   * List public active coupons for customer discovery.
   */
  async listActiveCoupons() {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        id: true,
        code: true,
        description: true,
        discountType: true,
        discountValue: true,
        maxDiscountAmount: true,
        minPurchaseAmount: true,
        endDate: true,
        bannerUrl: true,
      },
      orderBy: { discountValue: 'desc' },
    });

    return coupons.map((c) => ({
      ...c,
      discountValue: round2(c.discountValue),
      maxDiscountAmount: c.maxDiscountAmount ? round2(c.maxDiscountAmount) : null,
      minPurchaseAmount: round2(c.minPurchaseAmount),
    }));
  }

  /**
   * Admin: List coupons with pagination and filtering.
   */
  async listCoupons({ page = 1, limit = 20, search = '', isActive = null, discountType = null } = {}) {
    const skip = (page - 1) * limit;
    const where = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === true || isActive === 'true';
    }

    if (discountType) {
      where.discountType = discountType;
    }

    const [total, coupons] = await Promise.all([
      prisma.coupon.count({ where }),
      prisma.coupon.findMany({
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
      coupons: coupons.map((c) => {
        const productIds = (c.applicableProducts || []).map((ap) => ap.productId);
        const categoryIds = (c.applicableCategories || []).map((ac) => ac.categoryId);
        const collectionIds = (c.applicableCollections || []).map((ac) => ac.collectionId);

        return {
          ...c,
          discountValue: round2(c.discountValue),
          maxDiscountAmount: c.maxDiscountAmount ? round2(c.maxDiscountAmount) : null,
          minPurchaseAmount: round2(c.minPurchaseAmount),
          productIds,
          categoryIds,
          collectionIds,
          couponProducts: productIds.map((productId) => ({ productId })),
          couponCategories: categoryIds.map((categoryId) => ({ categoryId })),
          couponCollections: collectionIds.map((collectionId) => ({ collectionId })),
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
   * Admin: Get coupon by ID.
   */
  async getCouponById(id) {
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        applicableProducts: { include: { product: true } },
        applicableCategories: { include: { category: true } },
        applicableCollections: { include: { collection: true } },
        _count: { select: { usages: true } },
      },
    });

    if (!coupon) {
      throw ApplicationError.notFound(`Coupon "${id}" not found`);
    }

    const productIds = (coupon.applicableProducts || []).map((ap) => ap.productId);
    const categoryIds = (coupon.applicableCategories || []).map((ac) => ac.categoryId);
    const collectionIds = (coupon.applicableCollections || []).map((ac) => ac.collectionId);

    return {
      ...coupon,
      discountValue: round2(coupon.discountValue),
      maxDiscountAmount: coupon.maxDiscountAmount ? round2(coupon.maxDiscountAmount) : null,
      minPurchaseAmount: round2(coupon.minPurchaseAmount),
      productIds,
      categoryIds,
      collectionIds,
      couponProducts: productIds.map((productId) => ({ productId })),
      couponCategories: categoryIds.map((categoryId) => ({ categoryId })),
      couponCollections: collectionIds.map((collectionId) => ({ collectionId })),
    };
  }

  /**
   * Admin: Create a new coupon.
   */
  async createCoupon(data) {
    const normalizedCode = data.code.trim().toUpperCase();

    const existing = await prisma.coupon.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw ApplicationError.conflict(`Coupon code "${normalizedCode}" already exists`);
    }

    const {
      productIds = [],
      categoryIds = [],
      collectionIds = [],
      startDate,
      endDate,
      discountValue,
      maxDiscountAmount,
      minPurchaseAmount,
      validFrom,
      validUntil,
      minOrderAmount,
      perCustomerLimit,
      perUserLimit,
      ...rest
    } = data;

    const resolvedStartDate = startDate || validFrom || new Date();
    const resolvedEndDate = endDate || validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const resolvedMinPurchaseAmount = minPurchaseAmount ?? minOrderAmount ?? 0;
    const resolvedPerCustomerLimit = perCustomerLimit ?? perUserLimit ?? 1;

    const coupon = await prisma.coupon.create({
      data: {
        ...rest,
        code: normalizedCode,
        startDate: new Date(resolvedStartDate),
        endDate: new Date(resolvedEndDate),
        discountValue: toDecimal(discountValue),
        maxDiscountAmount: maxDiscountAmount != null ? toDecimal(maxDiscountAmount) : null,
        minPurchaseAmount: toDecimal(resolvedMinPurchaseAmount),
        perCustomerLimit: Number(resolvedPerCustomerLimit),
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

    return coupon;
  }

  /**
   * Admin: Update coupon.
   */
  async updateCoupon(id, data) {
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw ApplicationError.notFound(`Coupon "${id}" not found`);
    }

    const {
      productIds,
      categoryIds,
      collectionIds,
      startDate,
      endDate,
      discountValue,
      maxDiscountAmount,
      minPurchaseAmount,
      code,
      ...rest
    } = data;

    const updatePayload = { ...rest };

    if (code) {
      updatePayload.code = code.trim().toUpperCase();
    }
    const rawStartDate = startDate || data.validFrom;
    if (rawStartDate) updatePayload.startDate = new Date(rawStartDate);
    const rawEndDate = endDate || data.validUntil;
    if (rawEndDate) updatePayload.endDate = new Date(rawEndDate);
    if (discountValue != null) updatePayload.discountValue = toDecimal(discountValue);
    if (maxDiscountAmount !== undefined) {
      updatePayload.maxDiscountAmount = maxDiscountAmount != null ? toDecimal(maxDiscountAmount) : null;
    }
    const rawMinAmount = minPurchaseAmount ?? data.minOrderAmount;
    if (rawMinAmount != null) updatePayload.minPurchaseAmount = toDecimal(rawMinAmount);
    const rawCustomerLimit = data.perCustomerLimit ?? data.perUserLimit;
    if (rawCustomerLimit != null) updatePayload.perCustomerLimit = Number(rawCustomerLimit);

    return prisma.$transaction(async (tx) => {
      // Re-sync relationships if provided
      if (Array.isArray(productIds)) {
        await tx.couponProduct.deleteMany({ where: { couponId: id } });
        if (productIds.length > 0) {
          await tx.couponProduct.createMany({
            data: productIds.map((productId) => ({ couponId: id, productId })),
          });
        }
      }

      if (Array.isArray(categoryIds)) {
        await tx.couponCategory.deleteMany({ where: { couponId: id } });
        if (categoryIds.length > 0) {
          await tx.couponCategory.createMany({
            data: categoryIds.map((categoryId) => ({ couponId: id, categoryId })),
          });
        }
      }

      if (Array.isArray(collectionIds)) {
        await tx.couponCollection.deleteMany({ where: { couponId: id } });
        if (collectionIds.length > 0) {
          await tx.couponCollection.createMany({
            data: collectionIds.map((collectionId) => ({ couponId: id, collectionId })),
          });
        }
      }

      return tx.coupon.update({
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
   * Admin: Delete coupon.
   */
  async deleteCoupon(id) {
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw ApplicationError.notFound(`Coupon "${id}" not found`);
    }

    await prisma.coupon.delete({ where: { id } });
    return { id, message: 'Coupon deleted successfully' };
  }
}

export default new CouponService();

