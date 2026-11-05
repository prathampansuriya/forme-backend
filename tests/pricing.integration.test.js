import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.config.js';
import pricingService from '../src/services/pricing.service.js';
import { round2, toDecimal, formatCurrency } from '../src/utils/pricingMath.js';
import { DiscountType, FlashSaleStatus, ProductStatus, VariantStatus } from '@prisma/client';

describe('FORME Authoritative Pricing Engine, Coupons, Offers & Flash Sales Suite', { timeout: 45000 }, () => {
  let adminToken = null;
  let customerToken = null;
  let testCustomerId = null;
  let testCategoryOuterwear = null;
  let testCategoryDresses = null;
  let testCollectionRunway = null;
  let productStandard = null;
  let variantStandard = null;
  let productDiscounted = null;
  let variantDiscounted = null;
  let variantOverridden = null;
  let productDress = null;
  let variantDress = null;
  let flashSaleActive = null;
  let flashSaleExpired = null;
  let couponPercentage = null;
  let couponFlat = null;
  let couponCapped = null;
  let couponRestricted = null;
  let couponExpired = null;
  let offerCategory = null;
  let offerCollection = null;

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'admin@forme.store',
        password: 'FormeAdmin@2026!',
      });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.accessToken;

    // 2. Provision Test Customer
    const testEmail = `pricing.client.${Date.now()}@forme.store`;
    const customerPassword = 'ClientPassword2026!';
    const passwordHash = await bcrypt.hash(customerPassword, 10);

    const customer = await prisma.user.create({
      data: {
        name: 'Margaux Rostand',
        email: testEmail,
        passwordHash,
        role: 'CUSTOMER',
        isEmailVerified: true,
      },
    });
    testCustomerId = customer.id;

    const customerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: customerPassword,
      });
    expect(customerLoginRes.status).toBe(200);
    customerToken = customerLoginRes.body.data.accessToken;

    // 3. Provision Categories & Collections for Pricing Tests
    testCategoryOuterwear = await prisma.category.create({
      data: {
        name: `Outerwear Atelier ${Date.now()}`,
        slug: `outerwear-atelier-${Date.now()}`,
        description: 'Luxury coats and capes',
        status: 'ACTIVE',
      },
    });

    testCategoryDresses = await prisma.category.create({
      data: {
        name: `Silk Dresses ${Date.now()}`,
        slug: `silk-dresses-${Date.now()}`,
        description: 'Mulberry silk runway dresses',
        status: 'ACTIVE',
      },
    });

    testCollectionRunway = await prisma.collection.create({
      data: {
        name: `Runway 2026 ${Date.now()}`,
        slug: `runway-2026-${Date.now()}`,
        description: 'Haute couture editorial collection',
        isPublished: true,
      },
    });

    // 4. Provision Products
    // Product 1: Standard full-price product (no compare-at)
    productStandard = await prisma.product.create({
      data: {
        name: 'Structured Wool Coat',
        slug: `structured-wool-coat-${Date.now()}`,
        baseSku: `SKU-WOL-${Date.now()}`,
        categoryId: testCategoryOuterwear.id,
        productType: 'Coat',
        sellingPrice: 10000.0,
        compareAtPrice: null,
        status: ProductStatus.PUBLISHED,
        variants: {
          create: [
            {
              sku: `VAR-WOL-38-${Date.now()}`,
              size: '38',
              colorName: 'Midnight Noir',
              colorHex: '#121212',
              stockQuantity: 20,
              availableQuantity: 20,
              status: VariantStatus.ACTIVE,
            },
          ],
        },
      },
      include: { variants: true },
    });
    variantStandard = productStandard.variants[0];

    // Product 2: Product with compare-at markdown and variant override
    productDiscounted = await prisma.product.create({
      data: {
        name: 'Cashmere Trench Heritage',
        slug: `cashmere-trench-heritage-${Date.now()}`,
        baseSku: `SKU-CSH-${Date.now()}`,
        categoryId: testCategoryOuterwear.id,
        productType: 'Trench Coat',
        sellingPrice: 20000.0,
        compareAtPrice: 25000.0, // 5000 base markdown
        status: ProductStatus.PUBLISHED,
        collectionProducts: {
          create: [{ collectionId: testCollectionRunway.id }],
        },
        variants: {
          create: [
            {
              sku: `VAR-CSH-38-${Date.now()}`,
              size: '38',
              colorName: 'Camel',
              colorHex: '#C19A6B',
              stockQuantity: 15,
              availableQuantity: 15,
              status: VariantStatus.ACTIVE,
            },
            {
              sku: `VAR-CSH-42-OVR-${Date.now()}`,
              size: '42',
              colorName: 'Camel',
              colorHex: '#C19A6B',
              priceOverride: 22000.0, // Variant price override
              compareAtPriceOverride: 28000.0, // Variant compare-at override
              stockQuantity: 10,
              availableQuantity: 10,
              status: VariantStatus.ACTIVE,
            },
          ],
        },
      },
      include: { variants: true },
    });
    variantDiscounted = productDiscounted.variants.find((v) => !v.priceOverride);
    variantOverridden = productDiscounted.variants.find((v) => v.priceOverride);

    // Product 3: Silk Dress for Category Offer testing
    productDress = await prisma.product.create({
      data: {
        name: 'Mulberry Silk Bias Slip',
        slug: `mulberry-silk-bias-slip-${Date.now()}`,
        baseSku: `SKU-SLK-${Date.now()}`,
        categoryId: testCategoryDresses.id,
        productType: 'Slip Dress',
        sellingPrice: 15000.0,
        compareAtPrice: 15000.0,
        status: ProductStatus.PUBLISHED,
        variants: {
          create: [
            {
              sku: `VAR-SLK-S-${Date.now()}`,
              size: 'S',
              colorName: 'Champagne Rose',
              colorHex: '#F7E7CE',
              stockQuantity: 12,
              availableQuantity: 12,
              status: VariantStatus.ACTIVE,
            },
          ],
        },
      },
      include: { variants: true },
    });
    variantDress = productDress.variants[0];

    // 5. Provision Active Flash Sale on standard product (25% off)
    flashSaleActive = await prisma.flashSale.create({
      data: {
        name: 'Runway Midnight Drop',
        slug: `runway-midnight-drop-${Date.now()}`,
        description: '25% off selected structured outerwear pieces',
        startTime: new Date(Date.now() - 3600 * 1000), // Started 1h ago
        endTime: new Date(Date.now() + 24 * 3600 * 1000), // Ends in 24h
        status: FlashSaleStatus.ACTIVE,
        priority: 5,
        products: {
          create: [
            {
              productId: productStandard.id,
              variantId: variantStandard.id,
              discountType: DiscountType.PERCENTAGE,
              discountValue: 25.0, // 25% discount
              stockLimit: 10,
              soldCount: 0,
            },
          ],
        },
      },
      include: { products: true },
    });

    // 6. Provision Expired Flash Sale
    flashSaleExpired = await prisma.flashSale.create({
      data: {
        name: 'Past Season Archive Sale',
        slug: `past-archive-sale-${Date.now()}`,
        startTime: new Date(Date.now() - 48 * 3600 * 1000),
        endTime: new Date(Date.now() - 24 * 3600 * 1000),
        status: FlashSaleStatus.EXPIRED,
      },
    });

    // 7. Provision Promotional Offers
    // Category Offer: 10% off Dresses
    offerCategory = await prisma.offer.create({
      data: {
        name: 'Autumn Silk Event — 10% Off Silk Dresses',
        slug: `autumn-silk-event-${Date.now()}`,
        description: '10% promotional reduction on luxury silk dresses',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10.0,
        startDate: new Date(Date.now() - 3600 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        isActive: true,
        applicableCategories: {
          create: [{ categoryId: testCategoryDresses.id }],
        },
      },
    });

    // Collection Offer: 15% off Runway Collection
    offerCollection = await prisma.offer.create({
      data: {
        name: 'Private Runway Preview — 15% Off Runway Collection',
        slug: `private-runway-preview-${Date.now()}`,
        description: '15% off Runway 2026 Collection',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 15.0,
        startDate: new Date(Date.now() - 3600 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        isActive: true,
        applicableCollections: {
          create: [{ collectionId: testCollectionRunway.id }],
        },
      },
    });

    // 8. Provision Coupons
    // Percentage coupon: 15% off, min cart 20000
    couponPercentage = await prisma.coupon.create({
      data: {
        code: `PRCENT15_${Date.now()}`,
        description: '15% VIP clientele discount',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 15.0,
        minPurchaseAmount: 10000.0,
        startDate: new Date(Date.now() - 3600 * 1000),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        isActive: true,
      },
    });

    // Flat coupon: ₹2,000 off, min cart 10000
    couponFlat = await prisma.coupon.create({
      data: {
        code: `FLAT2000_${Date.now()}`,
        description: '₹2,000 welcome credit',
        discountType: DiscountType.FLAT,
        discountValue: 2000.0,
        minPurchaseAmount: 10000.0,
        startDate: new Date(Date.now() - 3600 * 1000),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        isActive: true,
      },
    });

    // Capped coupon: 20% off with max discount ₹3,000
    couponCapped = await prisma.coupon.create({
      data: {
        code: `CAPPED20_${Date.now()}`,
        description: '20% off capped at ₹3,000',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20.0,
        maxDiscountAmount: 3000.0,
        minPurchaseAmount: 5000.0,
        startDate: new Date(Date.now() - 3600 * 1000),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        isActive: true,
      },
    });

    // Category-restricted coupon: applies ONLY to Silk Dresses
    couponRestricted = await prisma.coupon.create({
      data: {
        code: `SILKONLY_${Date.now()}`,
        description: 'Exclusive 20% off Silk Dresses category',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20.0,
        minPurchaseAmount: 5000.0,
        startDate: new Date(Date.now() - 3600 * 1000),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        isActive: true,
        applicableCategories: {
          create: [{ categoryId: testCategoryDresses.id }],
        },
      },
    });

    // Expired coupon
    couponExpired = await prisma.coupon.create({
      data: {
        code: `EXPIRED_${Date.now()}`,
        description: 'Expired promotional voucher',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20.0,
        startDate: new Date(Date.now() - 60 * 24 * 3600 * 1000),
        endDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
        isActive: true,
      },
    });
  }, 45000);

  afterAll(async () => {
    // Cleanup created test records
    if (flashSaleActive?.id) {
      await prisma.flashSaleProduct.deleteMany({ where: { flashSaleId: flashSaleActive.id } }).catch(() => {});
    }
    const fsIds = [flashSaleActive?.id, flashSaleExpired?.id].filter(Boolean);
    if (fsIds.length > 0) {
      await prisma.flashSale.deleteMany({ where: { id: { in: fsIds } } }).catch(() => {});
    }
    const catIds = [testCategoryOuterwear?.id, testCategoryDresses?.id].filter(Boolean);
    if (catIds.length > 0) {
      await prisma.couponCategory.deleteMany({ where: { categoryId: { in: catIds } } }).catch(() => {});
      await prisma.offerCategory.deleteMany({ where: { categoryId: { in: catIds } } }).catch(() => {});
    }
    const cpnIds = [couponPercentage?.id, couponFlat?.id, couponCapped?.id, couponRestricted?.id, couponExpired?.id].filter(Boolean);
    if (cpnIds.length > 0) {
      await prisma.coupon.deleteMany({ where: { id: { in: cpnIds } } }).catch(() => {});
    }
    if (testCollectionRunway?.id) {
      await prisma.offerCollection.deleteMany({ where: { collectionId: testCollectionRunway.id } }).catch(() => {});
      await prisma.collectionProduct.deleteMany({ where: { collectionId: testCollectionRunway.id } }).catch(() => {});
      await prisma.collection.deleteMany({ where: { id: testCollectionRunway.id } }).catch(() => {});
    }
    const offIds = [offerCategory?.id, offerCollection?.id].filter(Boolean);
    if (offIds.length > 0) {
      await prisma.offer.deleteMany({ where: { id: { in: offIds } } }).catch(() => {});
    }
    const varIds = [variantStandard?.id, variantDiscounted?.id, variantOverridden?.id, variantDress?.id].filter(Boolean);
    if (varIds.length > 0) {
      await prisma.productVariant.deleteMany({ where: { id: { in: varIds } } }).catch(() => {});
    }
    const prodIds = [productStandard?.id, productDiscounted?.id, productDress?.id].filter(Boolean);
    if (prodIds.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: prodIds } } }).catch(() => {});
    }
    if (catIds.length > 0) {
      await prisma.category.deleteMany({ where: { id: { in: catIds } } }).catch(() => {});
    }
    if (testCustomerId) {
      await prisma.user.deleteMany({ where: { id: testCustomerId } }).catch(() => {});
    }
  }, 45000);

  // =========================================================================
  // 1. Authoritative Base Pricing & Discount Structures
  // =========================================================================
  describe('1. Authoritative Base Pricing & Discount Structures', () => {
    it('should calculate baseline pricing with NO discount when selling price equals MRP', async () => {
      // Temporarily test item without active promotions
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 1 }],
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Number(data.mrpSubtotal)).toBe(15000);
      expect(Number(data.baseSellingSubtotal)).toBe(15000);
      expect(Number(data.productDiscount)).toBe(0);
      // Category offer is 10% on Dresses
      expect(Number(data.offerDiscount)).toBe(1500); // 10% of 15000
      expect(Number(data.taxableSubtotal)).toBe(13500);
      // Tax: 12% on 13500 = 1620
      expect(Number(data.tax)).toBe(1620);
      expect(Number(data.finalPayableAmount)).toBe(13500 + 1620);
    });

    it('should calculate Product Discount (MRP vs Base Selling Markdown)', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDiscounted.id, quantity: 1 }],
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      // MRP = 25000, baseSelling = 20000 -> productDiscount = 5000
      expect(Number(data.mrpSubtotal)).toBe(25000);
      expect(Number(data.baseSellingSubtotal)).toBe(20000);
      expect(Number(data.productDiscount)).toBe(5000);
      // Collection offer of 15% on Runway 2026: 15% of 20000 = 3000
      expect(Number(data.offerDiscount)).toBe(3000);
      expect(Number(data.totalSavings)).toBe(5000 + 3000);
      expect(Number(data.taxableSubtotal)).toBe(17000);
    });

    it('should respect Variant Price Overrides and Variant Compare-at Overrides', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantOverridden.id, quantity: 1 }],
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      // Variant 42 has priceOverride 22000 and compareAtPriceOverride 28000
      expect(Number(data.mrpSubtotal)).toBe(28000);
      expect(Number(data.baseSellingSubtotal)).toBe(22000);
      expect(Number(data.productDiscount)).toBe(6000);
      // Collection offer 15% of 22000 = 3300
      expect(Number(data.offerDiscount)).toBe(3300);
      expect(Number(data.taxableSubtotal)).toBe(18700);
    });
  });

  // =========================================================================
  // 2. Promotional Offers & Deterministic Flash Sale Priority
  // =========================================================================
  describe('2. Promotional Offers & Deterministic Flash Sale Priority', () => {
    it('should apply Category Offer automatically to eligible garments', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 2 }],
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      // 2 * 15000 = 30000 base, 10% category offer = 3000
      expect(Number(data.baseSellingSubtotal)).toBe(30000);
      expect(Number(data.offerDiscount)).toBe(3000);
      expect(data.items[0].appliedPromotion).toBeDefined();
      expect(data.items[0].appliedPromotion.type).toBe('CATEGORY_OFFER');
    });

    it('should apply Collection Offer to garments associated with collection', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDiscounted.id, quantity: 1 }],
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.items[0].appliedPromotion).toBeDefined();
      expect(data.items[0].appliedPromotion.type).toBe('COLLECTION_OFFER');
      expect(Number(data.offerDiscount)).toBe(3000); // 15% of 20000
    });

    it('should enforce Flash Sale priority over ordinary offers on the same garment', async () => {
      // standard product has active Flash Sale (25% off)
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantStandard.id, quantity: 1 }],
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      // 25% of 10000 = 2500 flash sale discount
      expect(Number(data.flashSaleDiscount)).toBe(2500);
      expect(Number(data.offerDiscount)).toBe(0);
      expect(data.items[0].appliedPromotion.type).toBe('FLASH_SALE');
      expect(data.items[0].appliedPromotion.name).toBe('Runway Midnight Drop');
      expect(Number(data.taxableSubtotal)).toBe(7500);
    });

    it('should ignore Expired Flash Sales and fall back to standard pricing', async () => {
      // Simulate calculation with past flash sale
      const itemPrice = pricingService.calculateItemPrice({
        product: productStandard,
        variant: variantStandard,
        activeFlashSales: [flashSaleExpired],
        activeOffers: [],
        now: new Date(),
      });

      expect(Number(itemPrice.flashSaleDiscount)).toBe(0);
      expect(itemPrice.hasPromotion).toBe(false);
      expect(Number(itemPrice.effectiveSellingPrice)).toBe(10000);
    });
  });

  // =========================================================================
  // 3. Coupon Calculations & Stacking Rules
  // =========================================================================
  describe('3. Coupon Calculations & Stacking Rules', () => {
    it('should calculate Percentage Coupon correctly', async () => {
      // Dress item: 15000 base, 1500 category offer = 13500 effective subtotal
      // Coupon: 15% on 13500 = 2025 discount
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 1 }],
          couponCode: couponPercentage.code,
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.appliedCoupon).toBeDefined();
      expect(data.appliedCoupon.code).toBe(couponPercentage.code);
      expect(Number(data.couponDiscount)).toBe(2025);
      expect(Number(data.taxableSubtotal)).toBe(13500 - 2025); // 11475
    });

    it('should calculate Fixed Amount Coupon correctly', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 1 }],
          couponCode: couponFlat.code,
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.appliedCoupon).toBeDefined();
      expect(Number(data.couponDiscount)).toBe(2000);
      expect(Number(data.taxableSubtotal)).toBe(13500 - 2000); // 11500
    });

    it('should enforce Maximum Discount Cap on percentage coupons', async () => {
      // Subtotal = 2 * 13500 = 27000. 20% of 27000 is 5400, but capped at 3000
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 2 }],
          couponCode: couponCapped.code,
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Number(data.couponDiscount)).toBe(3000); // Strictly capped
    });

    it('should enforce Category-restricted coupons and ignore ineligible items (Mixed Eligibility)', async () => {
      // Item 1: Dress (eligible for SILKONLY coupon)
      // Item 2: Coat (INELIGIBLE for SILKONLY coupon)
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [
            { variantId: variantDress.id, quantity: 1 },
            { variantId: variantStandard.id, quantity: 1 },
          ],
          couponCode: couponRestricted.code,
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.appliedCoupon).toBeDefined();
      // Dress effective = 13500. 20% of 13500 = 2700
      expect(Number(data.couponDiscount)).toBe(2700);

      // Check item-level allocations
      const dressItem = data.items.find((i) => i.variantId === variantDress.id);
      const coatItem = data.items.find((i) => i.variantId === variantStandard.id);

      expect(Number(dressItem.lineCouponDiscount)).toBe(2700);
      expect(Number(coatItem.lineCouponDiscount)).toBe(0); // Ineligible item receives 0 coupon discount
    });

    it('should reject coupons when bag value is below Minimum Cart Value', async () => {
      // Standard item = 7500 effective (after flash sale). Coupon requires min 15000.
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantStandard.id, quantity: 1 }],
          couponCode: couponPercentage.code,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MIN_PURCHASE_NOT_MET');
    });

    it('should reject Expired Coupons with clear error code', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 1 }],
          couponCode: couponExpired.code,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('COUPON_EXPIRED');
    });

    it('should reject Inactive / Non-existent Coupons', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 1 }],
          couponCode: 'NONEXISTENT_VOUCHER_123',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_COUPON');
    });
  });

  // =========================================================================
  // 4. Proportional Allocation, Taxes & Shipping Rules
  // =========================================================================
  describe('4. Proportional Allocation, Taxes & Shipping Rules', () => {
    it('should allocate coupon discount proportionally across multiple items with exact penny/paisa reconciliation', async () => {
      // 2 items in bag:
      // Item 1: Dress (effective 13500)
      // Item 2: Coat (effective 7500)
      // Total effective = 21000.
      // Coupon: Flat 2000 off.
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [
            { variantId: variantDress.id, quantity: 1 },
            { variantId: variantStandard.id, quantity: 1 },
          ],
          couponCode: couponFlat.code,
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Number(data.couponDiscount)).toBe(2000);

      const item1 = data.items[0];
      const item2 = data.items[1];
      const sumItemCouponDiscounts = Number(item1.lineCouponDiscount) + Number(item2.lineCouponDiscount);

      // Exact reconciliation check: sum of allocations must equal total coupon discount
      expect(sumItemCouponDiscounts).toBe(2000);
      // Item 1 weight: 13500 / 21000 = 64.28% -> approx 1285.71
      expect(Number(item1.lineCouponDiscount)).toBeGreaterThan(Number(item2.lineCouponDiscount));
    });

    it('should calculate Intra-State GST (CGST + SGST) for Maharashtra (MH)', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 1 }],
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      const tax = res.body.data.taxBreakdown;
      expect(tax.isInterState).toBe(false);
      expect(Number(tax.cgst)).toBeGreaterThan(0);
      expect(Number(tax.sgst)).toBeGreaterThan(0);
      expect(Number(tax.igst)).toBe(0);
      expect(Number(tax.cgst)).toBe(Number(tax.sgst));
    });

    it('should calculate Inter-State GST (IGST) for other states (e.g. Karnataka KA, Delhi DL)', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 1 }],
          stateCode: 'KA',
        });

      expect(res.status).toBe(200);
      const tax = res.body.data.taxBreakdown;
      expect(tax.isInterState).toBe(true);
      expect(Number(tax.igst)).toBeGreaterThan(0);
      expect(Number(tax.cgst)).toBe(0);
      expect(Number(tax.sgst)).toBe(0);
    });

    it('should provide Free White Glove Shipping for orders above threshold and charge standard for low values', async () => {
      // High value order (13500 > 5000) -> free shipping
      const highRes = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [{ variantId: variantDress.id, quantity: 1 }],
          stateCode: 'MH',
        });

      expect(highRes.status).toBe(200);
      expect(Number(highRes.body.data.shippingCharge)).toBe(0);
      expect(highRes.body.data.shippingBreakdown.isFree).toBe(true);
    });

    it('should guarantee mathematical precision: Final Payable = Taxable + Tax + Shipping', async () => {
      const res = await request(app)
        .post('/api/v1/pricing/calculate')
        .send({
          items: [
            { variantId: variantDress.id, quantity: 2 },
            { variantId: variantDiscounted.id, quantity: 1 },
          ],
          couponCode: couponPercentage.code,
          stateCode: 'DL',
        });

      expect(res.status).toBe(200);
      const d = res.body.data;
      const calculatedPayable =
        Number(d.taxableSubtotal) + Number(d.tax) + Number(d.shippingCharge) + Number(d.additionalCharges);

      expect(Number(d.finalPayableAmount)).toBeCloseTo(calculatedPayable, 2);
      expect(Number(d.totalSavings)).toBe(
        Number(d.productDiscount) + Number(d.offerDiscount) + Number(d.flashSaleDiscount) + Number(d.couponDiscount)
      );
    });
  });

  // =========================================================================
  // 5. Coupon Discovery & Validation Endpoints
  // =========================================================================
  describe('5. Coupon Discovery & Validation Endpoints', () => {
    it('POST /api/v1/coupons/applicable should return applicable coupons with potential discount and clear eligibility reason', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/applicable')
        .send({
          items: [{ variantId: variantDress.id, quantity: 1 }],
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const foundCoupon = res.body.data.find((c) => c.code === couponFlat.code);
      expect(foundCoupon).toBeDefined();
      expect(foundCoupon.isApplicable).toBe(true);
      expect(Number(foundCoupon.potentialDiscount)).toBe(2000);
      expect(foundCoupon.reason).toBe('Ready to apply');
    });

    it('POST /api/v1/coupons/validate should validate coupon and return full calculation breakdown', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .send({
          code: couponFlat.code,
          items: [{ variantId: variantDress.id, quantity: 1 }],
          stateCode: 'MH',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.coupon.code).toBe(couponFlat.code);
      expect(Number(res.body.data.discountAmount)).toBe(2000);
      expect(res.body.data.breakdown).toBeDefined();
    });

    it('GET /api/v1/coupons/active should return public active coupons for customer discovery', async () => {
      const res = await request(app).get('/api/v1/coupons/active');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].code).toBeDefined();
      expect(res.body.data[0].discountType).toBeDefined();
    });
  });

  // =========================================================================
  // 6. Flash Sales Countdown & Product Restocking Rules
  // =========================================================================
  describe('6. Flash Sales Countdown & Product Restocking Rules', () => {
    it('GET /api/v1/flash-sales/active should return active drops with live countdown timer and products', async () => {
      const res = await request(app).get('/api/v1/flash-sales/active');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const activeDrop = res.body.data.find((fs) => fs.id === flashSaleActive.id);
      expect(activeDrop).toBeDefined();
      expect(activeDrop.countdown.isActive).toBe(true);
      expect(activeDrop.countdown.remainingSeconds).toBeGreaterThan(0);
      expect(activeDrop.products.length).toBeGreaterThan(0);
      expect(Number(activeDrop.products[0].flashPrice)).toBe(7500);
    });

    it('GET /api/v1/flash-sales/slug/:slug should return detailed flash sale by slug', async () => {
      const res = await request(app).get(`/api/v1/flash-sales/slug/${flashSaleActive.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(flashSaleActive.id);
      expect(res.body.data.name).toBe('Runway Midnight Drop');
      expect(res.body.data.countdown).toBeDefined();
    });

    it('should disable flash sale pricing once stockLimit is reached (Sold Out)', async () => {
      // Simulate sold out flash sale product
      const fsSoldOut = {
        id: 'fs-sold-out',
        status: FlashSaleStatus.ACTIVE,
        startTime: new Date(Date.now() - 3600 * 1000),
        endTime: new Date(Date.now() + 24 * 3600 * 1000),
        products: [
          {
            productId: productStandard.id,
            variantId: variantStandard.id,
            discountType: DiscountType.PERCENTAGE,
            discountValue: 25.0,
            stockLimit: 5,
            soldCount: 5, // Fully sold out!
          },
        ],
      };

      const itemPrice = pricingService.calculateItemPrice({
        product: productStandard,
        variant: variantStandard,
        activeFlashSales: [fsSoldOut],
        activeOffers: [],
        now: new Date(),
      });

      expect(itemPrice.hasPromotion).toBe(false);
      expect(Number(itemPrice.flashSaleDiscount)).toBe(0);
      expect(Number(itemPrice.effectiveSellingPrice)).toBe(10000);
    });
  });

  // =========================================================================
  // 7. Admin Promotional Management (Flash Sales, Coupons & Offers)
  // =========================================================================
  describe('7. Admin Promotional Management (Flash Sales, Coupons & Offers)', () => {
    let createdCouponId = null;
    let createdFlashSaleId = null;
    let createdOfferId = null;

    it('POST /api/v1/coupons should allow Admin to create coupon', async () => {
      const res = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `ADMINCPN_${Date.now()}`,
          description: 'Admin created campaign voucher',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          minPurchaseAmount: 5000,
          startDate: new Date(),
          endDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBeDefined();
      createdCouponId = res.body.data.id;
    });

    it('GET /api/v1/coupons should return paginated coupons for Admin', async () => {
      const res = await request(app)
        .get('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('DELETE /api/v1/coupons/:id should delete coupon', async () => {
      const res = await request(app)
        .delete(`/api/v1/coupons/${createdCouponId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('POST /api/v1/flash-sales should allow Admin to create flash sale with products', async () => {
      const res = await request(app)
        .post('/api/v1/flash-sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Flash Drop Atelier Exclusive',
          slug: `flash-drop-atelier-${Date.now()}`,
          description: 'Special 12-hour drop',
          startTime: new Date(),
          endTime: new Date(Date.now() + 12 * 3600 * 1000),
          priority: 2,
          products: [
            {
              productId: productStandard.id,
              variantId: variantStandard.id,
              discountType: 'PERCENTAGE',
              discountValue: 30,
              stockLimit: 5,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      createdFlashSaleId = res.body.data.id;
    });

    it('DELETE /api/v1/flash-sales/:id should delete flash sale', async () => {
      const res = await request(app)
        .delete(`/api/v1/flash-sales/${createdFlashSaleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('POST /api/v1/offers should allow Admin to create offer', async () => {
      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Winter Solstice Reduction',
          slug: `winter-solstice-${Date.now()}`,
          description: 'Exclusive 12% off winter pieces',
          discountType: 'PERCENTAGE',
          discountValue: 12,
          startDate: new Date(),
          endDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
          categoryIds: [testCategoryOuterwear.id],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      createdOfferId = res.body.data.id;
    });

    it('DELETE /api/v1/offers/:id should delete offer', async () => {
      const res = await request(app)
        .delete(`/api/v1/offers/${createdOfferId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should reject unauthenticated or non-admin attempts to access promotional CRUD', async () => {
      const res = await request(app)
        .post('/api/v1/coupons')
        .send({ code: 'UNAUTHORIZED_10', discountType: 'PERCENTAGE', discountValue: 10 });

      expect(res.status).toBe(401);
    });
  });
});
