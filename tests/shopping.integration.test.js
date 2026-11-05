import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.config.js';
import { DiscountType, ProductStatus, VariantStatus, OrderStatus, PaymentStatus } from '@prisma/client';

describe('FORME Shopping Backend Suite — Cart, Wishlist, Addresses, Reviews & Engagement', { timeout: 60000 }, () => {
  let adminToken = null;
  let customerAToken = null;
  let customerBToken = null;
  let customerA = null;
  let customerB = null;

  let testCategory = null;
  let testProduct = null;
  let variantSmall = null;
  let variantMedium = null;
  let testCoupon = null;
  let testOrder = null;

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'admin@forme.store',
        password: 'FormeAdmin@2026!',
      });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.accessToken;

    const timestamp = Date.now();
    const password = 'ShoppingPassword2026!';
    const passwordHash = await bcrypt.hash(password, 10);

    // 2. Provision Customer A
    customerA = await prisma.user.create({
      data: {
        name: 'Camille Claudel',
        email: `camille.${timestamp}@forme.store`,
        passwordHash,
        role: 'CUSTOMER',
        isEmailVerified: true,
      },
    });

    const loginARes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerA.email, password });
    expect(loginARes.status).toBe(200);
    customerAToken = loginARes.body.data.accessToken;

    // 3. Provision Customer B
    customerB = await prisma.user.create({
      data: {
        name: 'Julian Barnes',
        email: `julian.${timestamp}@forme.store`,
        passwordHash,
        role: 'CUSTOMER',
        isEmailVerified: true,
      },
    });

    const loginBRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerB.email, password });
    expect(loginBRes.status).toBe(200);
    customerBToken = loginBRes.body.data.accessToken;

    // 4. Provision Category, Product & Variants
    testCategory = await prisma.category.create({
      data: {
        name: `Tailoring ${timestamp}`,
        slug: `tailoring-${timestamp}`,
        description: 'Bespoke atelier tailoring',
        status: 'ACTIVE',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name: `Silk Wool Cape Trench ${timestamp}`,
        slug: `silk-wool-cape-trench-${timestamp}`,
        baseSku: `FRM-TRN-${timestamp}`,
        shortDescription: 'Double-faced silk wool trench coat.',
        longDescription: 'Engineered with sculptural storm flaps and architectural drape.',
        categoryId: testCategory.id,
        sellingPrice: 42000.0,
        compareAtPrice: 50000.0,
        productType: 'Trench Coat',
        status: ProductStatus.PUBLISHED,
        viewCount: 12,
        salesCount: 4,
      },
    });

    variantSmall = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        sku: `FRM-TRN-${timestamp}-BLK-S`,
        size: 'S',
        colorName: 'Noir Velvet',
        colorHex: '#111111',
        stockQuantity: 10,
        availableQuantity: 10,
        reservedQuantity: 0,
        status: VariantStatus.ACTIVE,
      },
    });

    variantMedium = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        sku: `FRM-TRN-${timestamp}-BLK-M`,
        size: 'M',
        colorName: 'Noir Velvet',
        colorHex: '#111111',
        stockQuantity: 5,
        availableQuantity: 5,
        reservedQuantity: 0,
        status: VariantStatus.ACTIVE,
      },
    });

    // 5. Provision Test Coupon
    testCoupon = await prisma.coupon.create({
      data: {
        code: `SHOPPING10-${timestamp}`,
        description: 'Shopping 10% Off',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10.0,
        minPurchaseAmount: 10000.0,
        maxDiscountAmount: 10000.0,
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + 86400000),
        isActive: true,
      },
    });

    // 6. Provision Verified Delivered Order for Customer A
    testOrder = await prisma.order.create({
      data: {
        orderNumber: `FRM-${timestamp}-ORD1`,
        userId: customerA.id,
        shippingAddressSnapshot: {
          recipientName: 'Camille Claudel',
          city: 'Mumbai',
          state: 'Maharashtra',
        },
        billingAddressSnapshot: {
          recipientName: 'Camille Claudel',
          city: 'Mumbai',
          state: 'Maharashtra',
        },
        itemSubtotal: 42000.0,
        mrpSubtotal: 50000.0,
        tax: 5040.0,
        shipping: 0.0,
        grandTotal: 47040.0,
        paymentStatus: PaymentStatus.CAPTURED,
        orderStatus: OrderStatus.DELIVERED,
        pricingBreakdown: {},
        items: {
          create: [
            {
              productId: testProduct.id,
              variantId: variantSmall.id,
              productName: testProduct.name,
              productSlug: testProduct.slug,
              sku: variantSmall.sku,
              selectedSize: variantSmall.size,
              selectedColor: variantSmall.colorName,
              productImage: 'https://images.unsplash.com/test.jpg',
              quantity: 1,
              unitSellingPrice: 42000.0,
              tax: 5040.0,
              finalItemAmount: 47040.0,
              variantDetails: {},
            },
          ],
        },
      },
    });
  }, 45000);

  afterAll(async () => {
    try {
      if (testOrder?.id) {
        await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } });
        await prisma.order.deleteMany({ where: { id: testOrder.id } });
      }
      if (testProduct?.id) {
        await prisma.reviewMedia.deleteMany({ where: { review: { productId: testProduct.id } } });
        await prisma.review.deleteMany({ where: { productId: testProduct.id } });
        await prisma.cartItem.deleteMany({ where: { variant: { productId: testProduct.id } } });
        await prisma.wishlistItem.deleteMany({ where: { productId: testProduct.id } });
        await prisma.productVariant.deleteMany({ where: { productId: testProduct.id } });
        await prisma.product.deleteMany({ where: { id: testProduct.id } });
      }
      if (testCategory?.id) {
        await prisma.category.deleteMany({ where: { id: testCategory.id } });
      }
      if (testCoupon?.id) {
        await prisma.coupon.deleteMany({ where: { id: testCoupon.id } });
      }
      if (customerA?.id) {
        await prisma.address.deleteMany({ where: { userId: customerA.id } });
        await prisma.cart.deleteMany({ where: { userId: customerA.id } });
        await prisma.wishlist.deleteMany({ where: { userId: customerA.id } });
        await prisma.user.deleteMany({ where: { id: customerA.id } });
      }
      if (customerB?.id) {
        await prisma.address.deleteMany({ where: { userId: customerB.id } });
        await prisma.cart.deleteMany({ where: { userId: customerB.id } });
        await prisma.wishlist.deleteMany({ where: { userId: customerB.id } });
        await prisma.user.deleteMany({ where: { id: customerB.id } });
      }
    } catch (e) {
      console.warn('Cleanup error in afterAll:', e.message);
    }
  });

  // ==========================================
  // SECTION 1: CART MODULE
  // ==========================================
  describe('1. Shopping Cart Module', () => {
    let guestSessionId = `guest_${Date.now()}`;
    let guestCartItemId = null;
    let customerCartItemId = null;

    it('1.1 should retrieve empty cart for guest with initialized pricing breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/cart')
        .set('x-guest-session-id', guestSessionId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(Number(res.body.data.pricing.finalPayableAmount)).toBe(0);
      expect(res.body.data.stockValidation.isValid).toBe(true);
    });

    it('1.2 should add item to guest cart and return server-authoritative calculated pricing', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('x-guest-session-id', guestSessionId)
        .send({
          variantId: variantSmall.id,
          quantity: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);

      const item = res.body.data.items[0];
      guestCartItemId = item.id;
      expect(item.variantId).toBe(variantSmall.id);
      expect(item.quantity).toBe(2);
      expect(Number(item.unitSellingPrice)).toBe(42000);
      expect(Number(item.lineEffectiveSubtotal)).toBe(84000);

      // Verify server calculation: subtotal 84,000 + GST 12% = 94,080, Free Shipping
      expect(Number(res.body.data.pricing.baseSellingSubtotal)).toBe(84000);
      expect(Number(res.body.data.pricing.tax)).toBe(10080);
      expect(Number(res.body.data.pricing.shippingCharge)).toBe(0);
      expect(Number(res.body.data.pricing.finalPayableAmount)).toBe(94080);
    });

    it('1.3 should reject adding non-existent variant ID to cart', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('x-guest-session-id', guestSessionId)
        .send({
          variantId: '00000000-0000-0000-0000-000000000000',
          quantity: 1,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VARIANT_NOT_FOUND');
    });

    it('1.4 should reject adding quantity exceeding available variant stock', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('x-guest-session-id', guestSessionId)
        .send({
          variantId: variantSmall.id,
          quantity: 999,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    });

    it('1.5 should update cart item quantity and recalculate pricing', async () => {
      const res = await request(app)
        .patch(`/api/v1/cart/items/${guestCartItemId}`)
        .set('x-guest-session-id', guestSessionId)
        .send({ quantity: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].quantity).toBe(1);
      expect(Number(res.body.data.pricing.baseSellingSubtotal)).toBe(42000);
      expect(Number(res.body.data.pricing.finalPayableAmount)).toBe(47040); // 42000 + 5040 tax
    });

    it('1.6 should apply valid promotional coupon to cart', async () => {
      const res = await request(app)
        .post('/api/v1/cart/coupon')
        .set('x-guest-session-id', guestSessionId)
        .send({ couponCode: testCoupon.code });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.couponCode).toBe(testCoupon.code);
      expect(Number(res.body.data.pricing.couponDiscount)).toBe(4200); // 10% of 42000
      expect(Number(res.body.data.pricing.taxableSubtotal)).toBe(37800);
    });

    it('1.7 should reject applying invalid / non-existent coupon', async () => {
      const res = await request(app)
        .post('/api/v1/cart/coupon')
        .set('x-guest-session-id', guestSessionId)
        .send({ couponCode: 'INVALIDCODE99' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_COUPON');
    });

    it('1.8 should remove coupon from cart and recalculate totals', async () => {
      const res = await request(app)
        .delete('/api/v1/cart/coupon')
        .set('x-guest-session-id', guestSessionId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.couponCode).toBeNull();
      expect(Number(res.body.data.pricing.couponDiscount)).toBe(0);
    });

    it('1.9 should validate live stock correctly', async () => {
      const res = await request(app)
        .get('/api/v1/cart/validate')
        .set('x-guest-session-id', guestSessionId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isValid).toBe(true);
    });

    it('1.10 should merge guest cart into customer account upon login', async () => {
      // 1. Customer B logs in and merges guestSessionId
      const mergeRes = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ guestSessionId });

      expect(mergeRes.status).toBe(200);
      expect(mergeRes.body.success).toBe(true);
      expect(mergeRes.body.data.items.length).toBe(1);
      expect(mergeRes.body.data.items[0].variantId).toBe(variantSmall.id);

      customerCartItemId = mergeRes.body.data.items[0].id;

      // 2. Old guest cart should now be empty / cleaned up
      const oldGuestRes = await request(app)
        .get('/api/v1/cart')
        .set('x-guest-session-id', guestSessionId);

      expect(oldGuestRes.body.data.items).toEqual([]);
    });

    it('1.11 should remove item from customer cart', async () => {
      const res = await request(app)
        .delete(`/api/v1/cart/items/${customerCartItemId}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('1.12 should clear cart completely', async () => {
      // Add medium variant
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ variantId: variantMedium.id, quantity: 1 });

      const clearRes = await request(app)
        .delete('/api/v1/cart')
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.success).toBe(true);
      expect(clearRes.body.data.items).toEqual([]);
    });
  });

  // ==========================================
  // SECTION 2: WISHLIST MODULE
  // ==========================================
  describe('2. Customer Wishlist Module', () => {
    it('2.1 should reject unauthenticated customer from accessing wishlist', async () => {
      const res = await request(app).get('/api/v1/wishlist');
      expect(res.status).toBe(401);
    });

    it('2.2 should add product to customer wishlist and avoid duplicates', async () => {
      const addRes = await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ productId: testProduct.id });

      expect(addRes.status).toBe(201);
      expect(addRes.body.success).toBe(true);
      expect(addRes.body.data.isWishlisted).toBe(true);

      // Adding again should be idempotent
      const duplicateRes = await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ productId: testProduct.id });

      expect(duplicateRes.status).toBe(201);
      expect(duplicateRes.body.data.isWishlisted).toBe(true);
    });

    it('2.3 should check product wishlisted status', async () => {
      const checkRes = await request(app)
        .get(`/api/v1/wishlist/check/${testProduct.id}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.isWishlisted).toBe(true);
    });

    it('2.4 should list garments in customer wishlist', async () => {
      const listRes = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.itemCount).toBe(1);
      expect(listRes.body.data.items[0].productId).toBe(testProduct.id);
      expect(listRes.body.data.items[0].name).toBe(testProduct.name);
      expect(listRes.body.data.items[0].inStock).toBe(true);
    });

    it('2.5 should move wishlisted garment into shopping bag', async () => {
      const moveRes = await request(app)
        .post('/api/v1/wishlist/move-to-cart')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          productId: testProduct.id,
          variantId: variantSmall.id,
          quantity: 1,
        });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.success).toBe(true);

      // Product should now be removed from wishlist
      const checkRes = await request(app)
        .get(`/api/v1/wishlist/check/${testProduct.id}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(checkRes.body.data.isWishlisted).toBe(false);

      // Garment should now be in customer A's bag
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(cartRes.body.data.items.length).toBe(1);
      expect(cartRes.body.data.items[0].variantId).toBe(variantSmall.id);
    });

    it('2.6 should remove item from customer wishlist', async () => {
      // Add back first
      await request(app)
        .post('/api/v1/wishlist/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ productId: testProduct.id });

      const removeRes = await request(app)
        .delete(`/api/v1/wishlist/items/${testProduct.id}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(removeRes.status).toBe(200);
      expect(removeRes.body.data.isWishlisted).toBe(false);
    });
  });

  // ==========================================
  // SECTION 3: ADDRESS BOOK & OWNERSHIP
  // ==========================================
  describe('3. Address Management & Security Hardening', () => {
    let addressA1Id = null;
    let addressA2Id = null;

    it('3.1 should create first address and automatically set default shipping and billing', async () => {
      const res = await request(app)
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          recipientName: 'Camille Claudel',
          phone: '+919876543210',
          addressLine1: 'Villa 12, Boulevard Haussmann',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'India',
          addressType: 'HOME',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDefaultShipping).toBe(true);
      expect(res.body.data.isDefaultBilling).toBe(true);
      addressA1Id = res.body.data.id;
    });

    it('3.2 should create second address with isDefaultShipping=true and unset previous default', async () => {
      const res = await request(app)
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          recipientName: 'Camille Studio',
          phone: '+919876543210',
          addressLine1: 'Atelier 4B, Nariman Point',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400021',
          country: 'India',
          addressType: 'WORK',
          isDefaultShipping: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.isDefaultShipping).toBe(true);
      addressA2Id = res.body.data.id;

      // Verify address 1 is no longer default shipping
      const addr1Res = await request(app)
        .get(`/api/v1/addresses/${addressA1Id}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(addr1Res.body.data.isDefaultShipping).toBe(false);
      expect(addr1Res.body.data.isDefaultBilling).toBe(true);
    });

    it('3.3 should list all customer addresses sorted with defaults first', async () => {
      const res = await request(app)
        .get('/api/v1/addresses')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].id).toBe(addressA2Id); // default shipping comes first
    });

    it('3.4 should REJECT Customer B from modifying Customer A address (Strict Ownership)', async () => {
      const res = await request(app)
        .patch(`/api/v1/addresses/${addressA1Id}`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ recipientName: 'Malicious Hijacker' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN_RESOURCE');
    });

    it('3.5 should REJECT Customer B from deleting Customer A address', async () => {
      const res = await request(app)
        .delete(`/api/v1/addresses/${addressA1Id}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN_RESOURCE');
    });

    it('3.6 should allow Customer A to update own address', async () => {
      const res = await request(app)
        .patch(`/api/v1/addresses/${addressA1Id}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ landmark: 'Near Regal Cinema' });

      expect(res.status).toBe(200);
      expect(res.body.data.landmark).toBe('Near Regal Cinema');
    });

    it('3.7 should allow Customer A to delete own address', async () => {
      const res = await request(app)
        .delete(`/api/v1/addresses/${addressA2Id}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // SECTION 4: REVIEWS & VERIFIED PURCHASE
  // ==========================================
  describe('4. Editorial Reviews & Verified Purchase', () => {
    let reviewId = null;

    it('4.1 should confirm Customer A is eligible for verified purchase review', async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/eligibility/${testProduct.id}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasPurchased).toBe(true);
      expect(res.body.data.canReview).toBe(true);
    });

    it('4.2 should confirm Customer B has NOT purchased this garment', async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/eligibility/${testProduct.id}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasPurchased).toBe(false);
    });

    it('4.3 should REJECT Customer B when submitting with verifiedOnly=true', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({
          productId: testProduct.id,
          rating: 5,
          content: 'I never bought this but wanted to leave a review.',
          verifiedOnly: true,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_ELIGIBLE_TO_REVIEW');
    });

    it('4.4 should submit verified purchase review for Customer A', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          productId: testProduct.id,
          rating: 5,
          headline: 'Sculptural masterpiece',
          content: 'The drape and finish are extraordinary. Truly architectural couture.',
          media: [
            {
              url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800',
              publicId: 'reviews/coat_123',
              mediaType: 'IMAGE',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isVerifiedPurchase).toBe(true);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.media.length).toBe(1);
      reviewId = res.body.data.id;
    });

    it('4.5 should REJECT duplicate review submission by the same customer', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          productId: testProduct.id,
          rating: 4,
          content: 'Second review attempt should fail.',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('REVIEW_ALREADY_EXISTS');
    });

    it('4.6 should REJECT Customer B from modifying Customer A review', async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ content: 'Tampered review content.' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_RESOURCE');
    });

    it('4.7 should allow author (Customer A) to update own review', async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ headline: 'An heirloom piece of tailoring' });

      expect(res.status).toBe(200);
      expect(res.body.data.headline).toBe('An heirloom piece of tailoring');
    });

    it('4.8 should retrieve public reviews and statistics for the product', async () => {
      const reviewsRes = await request(app).get(`/api/v1/reviews/product/${testProduct.id}`);
      expect(reviewsRes.status).toBe(200);
      expect(reviewsRes.body.data.length).toBe(1);
      expect(reviewsRes.body.data[0].isVerifiedPurchase).toBe(true);

      const statsRes = await request(app).get(`/api/v1/reviews/product/${testProduct.id}/stats`);
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.totalReviews).toBe(1);
      expect(statsRes.body.data.averageRating).toBe(5);
      expect(statsRes.body.data.verifiedPurchaseCount).toBe(1);
      expect(statsRes.body.data.ratingDistribution[5]).toBe(1);
    });

    it('4.9 should allow Admin to moderate reviews (hide and re-approve)', async () => {
      // Hide review
      const hideRes = await request(app)
        .patch(`/api/v1/reviews/admin/${reviewId}/moderation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isApproved: false });

      expect(hideRes.status).toBe(200);
      expect(hideRes.body.data.isApproved).toBe(false);

      // Now public query should return 0 reviews
      const publicRes = await request(app).get(`/api/v1/reviews/product/${testProduct.id}`);
      expect(publicRes.body.data.length).toBe(0);

      // Re-approve
      const approveRes = await request(app)
        .patch(`/api/v1/reviews/admin/${reviewId}/moderation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isApproved: true });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.isApproved).toBe(true);
    });
  });

  // ==========================================
  // SECTION 5: CUSTOMER PRODUCT ENGAGEMENT
  // ==========================================
  describe('5. Customer Engagement & Actual Metrics', () => {
    it('5.1 should track product view event and increment viewCount', async () => {
      const initialViewCount = testProduct.viewCount;

      const res = await request(app)
        .post('/api/v1/engagement/view')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ productId: testProduct.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await prisma.product.findUnique({
        where: { id: testProduct.id },
        select: { viewCount: true },
      });

      expect(updated.viewCount).toBe(initialViewCount + 1);
    });

    it('5.2 should retrieve recently viewed garments for customer', async () => {
      const res = await request(app)
        .get('/api/v1/engagement/recently-viewed')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].id).toBe(testProduct.id);
    });

    it('5.3 should log and track customer search query activity', async () => {
      const res = await request(app)
        .post('/api/v1/engagement/search')
        .send({
          query: 'silk wool trench',
          resultsCount: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.query).toBe('silk wool trench');
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
    });

    it('5.4 should calculate genuine trending metrics from database engagement signals', async () => {
      const res = await request(app).get('/api/v1/engagement/trending');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].score).toBeDefined();
    });
  });
});
