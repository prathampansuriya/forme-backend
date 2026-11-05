import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.config.js';
import inventoryService from '../src/services/inventory.service.js';
import { cleanExpiredReservations } from '../src/jobs/cleanExpiredReservations.job.js';
import { ProductStatus, VariantStatus, OrderStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

describe('FORME Inventory Management & Reservation Engine Suite', { timeout: 60000 }, () => {
  let adminToken = null;
  let customerToken = null;
  let testCustomer = null;
  let testCategory = null;
  let testProduct = null;
  let testVariantScarce = null; // 2 units physical stock for concurrency test
  let testVariantPlentiful = null; // 20 units stock
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
    const password = 'InventoryPassword2026!';
    const passwordHash = await bcrypt.hash(password, 10);

    // 2. Provision Test Customer
    testCustomer = await prisma.user.create({
      data: {
        name: 'Isolde Bresson',
        email: `isolde.${timestamp}@forme.store`,
        passwordHash,
        role: 'CUSTOMER',
        isEmailVerified: true,
      },
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testCustomer.email, password });
    expect(loginRes.status).toBe(200);
    customerToken = loginRes.body.data.accessToken;

    // 3. Provision Category, Product & Variants
    testCategory = await prisma.category.create({
      data: {
        name: `Atelier Outerwear ${timestamp}`,
        slug: `atelier-outerwear-${timestamp}`,
        description: 'Limited edition luxury outerwear',
        status: 'ACTIVE',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name: `Double-Faced Cashmere Wrap ${timestamp}`,
        slug: `cashmere-wrap-${timestamp}`,
        baseSku: `FRM-WRP-${timestamp}`,
        shortDescription: 'Cashmere wrap coat with artisanal hand-stitching.',
        categoryId: testCategory.id,
        sellingPrice: 75000.0,
        compareAtPrice: 85000.0,
        productType: 'Wrap Coat',
        status: ProductStatus.PUBLISHED,
      },
    });

    // Scarce Variant: strictly 2 units in warehouse (for concurrency race testing)
    testVariantScarce = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        sku: `FRM-WRP-${timestamp}-CAMEL-S`,
        size: 'S',
        colorName: 'Camel Melange',
        colorHex: '#C19A6B',
        stockQuantity: 2,
        reservedQuantity: 0,
        availableQuantity: 2,
        status: VariantStatus.ACTIVE,
      },
    });

    // Plentiful Variant: 20 units in warehouse
    testVariantPlentiful = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        sku: `FRM-WRP-${timestamp}-CAMEL-M`,
        size: 'M',
        colorName: 'Camel Melange',
        colorHex: '#C19A6B',
        stockQuantity: 20,
        reservedQuantity: 0,
        availableQuantity: 20,
        status: VariantStatus.ACTIVE,
      },
    });
  }, 45000);

  afterAll(async () => {
    try {
      if (testOrder?.id) {
        await prisma.stockMovement.deleteMany({ where: { variantId: testVariantPlentiful.id } });
        await prisma.inventoryLog.deleteMany({ where: { variantId: testVariantPlentiful.id } });
        await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } });
        await prisma.order.deleteMany({ where: { id: testOrder.id } });
      }
      if (testProduct?.id) {
        await prisma.inventoryReservation.deleteMany({
          where: { variantId: { in: [testVariantScarce.id, testVariantPlentiful.id] } },
        });
        await prisma.stockMovement.deleteMany({
          where: { variantId: { in: [testVariantScarce.id, testVariantPlentiful.id] } },
        });
        await prisma.inventoryLog.deleteMany({
          where: { variantId: { in: [testVariantScarce.id, testVariantPlentiful.id] } },
        });
        await prisma.productVariant.deleteMany({ where: { productId: testProduct.id } });
        await prisma.product.deleteMany({ where: { id: testProduct.id } });
      }
      if (testCategory?.id) {
        await prisma.category.deleteMany({ where: { id: testCategory.id } });
      }
      if (testCustomer?.id) {
        await prisma.user.deleteMany({ where: { id: testCustomer.id } });
      }
    } catch (e) {
      console.warn('Cleanup error in afterAll:', e.message);
    }
  });

  // ==========================================
  // SECTION 1: INVENTORY CALCULATION
  // ==========================================
  describe('1. Inventory Calculation & Invariants', () => {
    it('1.1 should correctly calculate Available Stock = Physical Stock - Active Reserved Stock', async () => {
      const stock = await inventoryService.calculateAvailableStock(testVariantScarce.id);

      expect(stock.physicalStock).toBe(2);
      expect(stock.reservedStock).toBe(0);
      expect(stock.availableStock).toBe(2);
      expect(stock.inStock).toBe(true);
    });

    it('1.2 should never allow negative available stock', async () => {
      // Attempting to reserve 5 units when only 2 are available must be rejected
      const res = await request(app)
        .post('/api/v1/inventory/reserve')
        .send({
          items: [{ variantId: testVariantScarce.id, quantity: 5 }],
          checkoutSessionId: `chk_${Date.now()}`,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');

      const stock = await inventoryService.calculateAvailableStock(testVariantScarce.id);
      expect(stock.availableStock).toBe(2);
      expect(stock.availableStock).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // SECTION 2: RESERVATION WORKFLOW & CONCURRENCY
  // ==========================================
  describe('2. Reservation Workflow & Concurrency Control', () => {
    let reservation1Id = null;
    let checkoutSession1 = `chk_session_${Date.now()}`;

    it('2.1 should create a 15-minute optimistic stock reservation during checkout', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/reserve')
        .send({
          items: [{ variantId: testVariantScarce.id, quantity: 1 }],
          checkoutSessionId: checkoutSession1,
          ttlMinutes: 15,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reservations.length).toBe(1);

      const r = res.body.data.reservations[0];
      reservation1Id = r.id;
      expect(r.quantity).toBe(1);
      expect(r.status).toBe('ACTIVE');

      // Check stock fields: Physical=2, Reserved=1, Available=1
      const stock = await inventoryService.calculateAvailableStock(testVariantScarce.id);
      expect(stock.physicalStock).toBe(2);
      expect(stock.reservedStock).toBe(1);
      expect(stock.availableStock).toBe(1);
    });

    it('2.2 should PREVENT overselling during concurrent checkout racing (Row-Level Lock)', async () => {
      // Currently: Physical=2, Reserved=1, Available=1.
      // Launch 2 simultaneous checkout requests each wanting 1 unit.
      // Exactly 1 must succeed and 1 must fail with INSUFFICIENT_STOCK. Zero double-booking!
      const sessionA = `race_a_${Date.now()}`;
      const sessionB = `race_b_${Date.now()}`;

      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/inventory/reserve')
          .send({
            items: [{ variantId: testVariantScarce.id, quantity: 1 }],
            checkoutSessionId: sessionA,
          }),
        request(app)
          .post('/api/v1/inventory/reserve')
          .send({
            items: [{ variantId: testVariantScarce.id, quantity: 1 }],
            checkoutSessionId: sessionB,
          }),
      ]);

      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      const successRes = resA.status === 201 ? resA : resB;
      const failedRes = resA.status === 400 ? resA : resB;

      expect(successRes.body.success).toBe(true);
      expect(failedRes.body.code).toBe('INSUFFICIENT_STOCK');

      // Now all 2 units are reserved, Available Stock must be exactly 0
      const stock = await inventoryService.calculateAvailableStock(testVariantScarce.id);
      expect(stock.physicalStock).toBe(2);
      expect(stock.reservedStock).toBe(2);
      expect(stock.availableStock).toBe(0);

      // Clean up race winner reservation
      const winningResId = successRes.body.data.reservations[0].id;
      await inventoryService.releaseReservation({ reservationIds: [winningResId] });
    });

    it('2.3 should release reservation when customer leaves checkout and return stock to circulation', async () => {
      // Release reservation1
      const res = await request(app)
        .post('/api/v1/inventory/release')
        .send({ reservationIds: [reservation1Id] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Available stock should be restored to 2
      const stock = await inventoryService.calculateAvailableStock(testVariantScarce.id);
      expect(stock.reservedStock).toBe(0);
      expect(stock.availableStock).toBe(2);
    });
  });

  // ==========================================
  // SECTION 3: RESERVATION EXPIRY SWEEPER
  // ==========================================
  describe('3. Reservation Expiration & Sweeper Engine', () => {
    it('3.1 should transition expired reservations to EXPIRED and restore stock', async () => {
      // 1. Artificially create an expired reservation (expiresAt 10 minutes ago)
      const expiredAt = new Date(Date.now() - 10 * 60 * 1000);
      const staleRes = await prisma.inventoryReservation.create({
        data: {
          variantId: testVariantScarce.id,
          quantity: 1,
          expiresAt: expiredAt,
          status: 'ACTIVE',
        },
      });

      // Update variant reserved/available quantities
      await prisma.productVariant.update({
        where: { id: testVariantScarce.id },
        data: {
          reservedQuantity: 1,
          availableQuantity: 1,
        },
      });

      // 2. Execute sweeper job
      const purgedCount = await cleanExpiredReservations();
      expect(purgedCount).toBeGreaterThanOrEqual(1);

      // 3. Verify reservation status transitioned to EXPIRED
      const updatedRes = await prisma.inventoryReservation.findUnique({
        where: { id: staleRes.id },
      });
      expect(updatedRes.status).toBe('EXPIRED');

      // 4. Verify stock restored back to circulation
      const stock = await inventoryService.calculateAvailableStock(testVariantScarce.id);
      expect(stock.reservedStock).toBe(0);
      expect(stock.availableStock).toBe(2);
    });
  });

  // ==========================================
  // SECTION 4: ORDER COMMITMENT (ONLINE & COD) & RESTORATION
  // ==========================================
  describe('4. Order Stock Commitment & Restoration Lifecycle', () => {
    let orderCheckoutSession = `chk_ord_${Date.now()}`;
    let committedOrderId = null;

    it('4.1 should commit inventory on online payment success (Physical stock deducted)', async () => {
      // 1. Reserve 2 units of plentiful variant
      const reserveRes = await inventoryService.createReservation({
        items: [{ variantId: testVariantPlentiful.id, quantity: 2 }],
        checkoutSessionId: orderCheckoutSession,
      });
      expect(reserveRes.reservations.length).toBe(1);

      // 2. Create Order
      testOrder = await prisma.order.create({
        data: {
          orderNumber: `FRM-ORD-INV-${Date.now()}`,
          userId: testCustomer.id,
          shippingAddressSnapshot: { recipientName: 'Isolde Bresson' },
          billingAddressSnapshot: { recipientName: 'Isolde Bresson' },
          itemSubtotal: 150000.0,
          mrpSubtotal: 170000.0,
          tax: 18000.0,
          shipping: 0.0,
          grandTotal: 168000.0,
          paymentMethod: PaymentMethod.RAZORPAY_UPI,
          paymentStatus: PaymentStatus.CAPTURED,
          orderStatus: OrderStatus.CONFIRMED,
          pricingBreakdown: {},
          items: {
            create: [
              {
                productId: testProduct.id,
                variantId: testVariantPlentiful.id,
                productName: testProduct.name,
                productSlug: testProduct.slug,
                sku: testVariantPlentiful.sku,
                selectedSize: 'M',
                selectedColor: 'Camel Melange',
                productImage: 'https://images.unsplash.com/test.jpg',
                quantity: 2,
                unitSellingPrice: 75000.0,
                tax: 18000.0,
                finalItemAmount: 168000.0,
                variantDetails: {},
              },
            ],
          },
        },
      });
      committedOrderId = testOrder.id;

      // 3. Commit inventory
      const commitRes = await inventoryService.commitReservation({
        checkoutSessionId: orderCheckoutSession,
        orderId: testOrder.id,
        paymentMethod: 'RAZORPAY',
      });
      expect(commitRes.success).toBe(true);

      // Physical stock should be decremented from 20 to 18
      const stock = await inventoryService.calculateAvailableStock(testVariantPlentiful.id);
      expect(stock.physicalStock).toBe(18);
      expect(stock.reservedStock).toBe(0);
      expect(stock.availableStock).toBe(18);

      // Stock movement must be recorded
      const movement = await prisma.stockMovement.findFirst({
        where: { variantId: testVariantPlentiful.id, type: 'ORDER_FULFILLMENT' },
        orderBy: { createdAt: 'desc' },
      });
      expect(movement).toBeDefined();
      expect(movement.quantity).toBe(-2);
      expect(movement.balanceAfter).toBe(18);
    });

    it('4.2 should define and support Cash on Delivery (COD) stock commitment lifecycle', async () => {
      // For COD, inventory is committed immediately upon order creation so units are held for the delivery carrier
      const codSession = `chk_cod_${Date.now()}`;
      await inventoryService.createReservation({
        items: [{ variantId: testVariantPlentiful.id, quantity: 1 }],
        checkoutSessionId: codSession,
      });

      const codOrder = await prisma.order.create({
        data: {
          orderNumber: `FRM-COD-${Date.now()}`,
          userId: testCustomer.id,
          shippingAddressSnapshot: { recipientName: 'Isolde Bresson' },
          billingAddressSnapshot: { recipientName: 'Isolde Bresson' },
          itemSubtotal: 75000.0,
          mrpSubtotal: 85000.0,
          tax: 9000.0,
          grandTotal: 84000.0,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.PENDING, // Payment pending doorstep collection
          orderStatus: OrderStatus.PLACED,
          pricingBreakdown: {},
          items: {
            create: [
              {
                productId: testProduct.id,
                variantId: testVariantPlentiful.id,
                productName: testProduct.name,
                productSlug: testProduct.slug,
                sku: testVariantPlentiful.sku,
                selectedSize: 'M',
                selectedColor: 'Camel Melange',
                productImage: 'https://images.unsplash.com/test.jpg',
                quantity: 1,
                unitSellingPrice: 75000.0,
                tax: 9000.0,
                finalItemAmount: 84000.0,
                variantDetails: {},
              },
            ],
          },
        },
      });

      // Commit COD order units
      const codCommit = await inventoryService.commitReservation({
        checkoutSessionId: codSession,
        orderId: codOrder.id,
        paymentMethod: 'CASH_ON_DELIVERY',
      });
      expect(codCommit.success).toBe(true);

      // Physical stock decremented from 18 to 17
      const stock = await inventoryService.calculateAvailableStock(testVariantPlentiful.id);
      expect(stock.physicalStock).toBe(17);

      // Clean up COD order
      await prisma.orderItem.deleteMany({ where: { orderId: codOrder.id } });
      await prisma.order.deleteMany({ where: { id: codOrder.id } });
    });

    it('4.3 should restore stock on order cancellation', async () => {
      // Cancel testOrder (which committed 2 units)
      const restoreRes = await inventoryService.restoreOrderStock({
        orderId: committedOrderId,
        reason: 'Customer cancelled prior to dispatch',
      });

      expect(restoreRes.success).toBe(true);

      // Stock should be restored from 17 to 19
      const stock = await inventoryService.calculateAvailableStock(testVariantPlentiful.id);
      expect(stock.physicalStock).toBe(19);
      expect(stock.availableStock).toBe(19);

      // Verify cancellation stock movement
      const cancelMovement = await prisma.stockMovement.findFirst({
        where: { variantId: testVariantPlentiful.id, type: 'ORDER_CANCELLATION' },
        orderBy: { createdAt: 'desc' },
      });
      expect(cancelMovement.quantity).toBe(2);
    });

    it('4.4 should restock returned garment after physical warehouse inspection', async () => {
      const restockRes = await request(app)
        .post('/api/v1/inventory/return-restock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderId: committedOrderId,
          variantId: testVariantPlentiful.id,
          quantity: 1,
          reason: 'Customer return inspected and approved',
        });

      expect(restockRes.status).toBe(200);
      expect(restockRes.body.success).toBe(true);

      // Stock incremented from 19 to 20
      const stock = await inventoryService.calculateAvailableStock(testVariantPlentiful.id);
      expect(stock.physicalStock).toBe(20);
      expect(stock.availableStock).toBe(20);
    });
  });

  // ==========================================
  // SECTION 5: ADMIN INVENTORY MANAGEMENT & AUDIT LOGS
  // ==========================================
  describe('5. Admin Inventory Management & Audit APIs', () => {
    it('5.1 should list inventory variants with pagination and stock counts', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.meta).toBeDefined();
    });

    it('5.2 should filter low-stock variants', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/low-stock?threshold=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Scarce variant has 2 units, which is <= 5
      const foundScarce = res.body.data.some((v) => v.id === testVariantScarce.id);
      expect(foundScarce).toBe(true);
    });

    it('5.3 should inspect variant stock details and active reservations', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/variant/${testVariantScarce.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.sku).toBe(testVariantScarce.sku);
      expect(res.body.data.stockQuantity).toBe(2);
    });

    it('5.4 should perform manual stock adjustment with audit logging', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variantId: testVariantScarce.id,
          newStockQuantity: 15,
          reason: 'Artisanal batch recount confirmed 15 units in warehouse',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newStock).toBe(15);
      expect(res.body.data.difference).toBe(13); // 15 - 2

      const stock = await inventoryService.calculateAvailableStock(testVariantScarce.id);
      expect(stock.physicalStock).toBe(15);
    });

    it('5.5 should replenish stock with purchase receipt tracking', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/replenish')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variantId: testVariantScarce.id,
          quantity: 10,
          reason: 'Autumn drop restock arrival',
          costPerUnit: 35000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalPhysicalStock).toBe(25); // 15 + 10
    });

    it('5.6 should perform stock reduction / damage write-off', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/reduce')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variantId: testVariantScarce.id,
          quantity: 2,
          reason: 'Showroom display fabric snag',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.remainingStock).toBe(23); // 25 - 2
    });

    it('5.7 should retrieve full audit history logs for variant', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/history/${testVariantScarce.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('5.8 should retrieve executive inventory valuation reports', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalVariants).toBeGreaterThan(0);
      expect(res.body.data.totalPhysicalUnits).toBeGreaterThan(0);
      expect(res.body.data.totalValuation).toBeGreaterThan(0);
      expect(res.body.data.currency).toBe('INR');
    });

    it('5.9 should REJECT non-admin users from accessing inventory management', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/reports')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});

