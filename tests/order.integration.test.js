import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.config.js';
import razorpayUtil from '../src/utils/razorpay.util.js';
import inventoryService from '../src/services/inventory.service.js';

describe('FORME Order Management, Checkout, COD & Razorpay Integration Suite', { timeout: 60000 }, () => {
  let adminToken = null;
  let customerAToken = null;
  let customerBToken = null;
  let customerA = null;
  let customerB = null;
  let savedAddressA = null;
  let testCategory = null;
  let testProduct = null;
  let testProductHaute = null;
  let testVariantA = null; // Standard garment (₹15,000, 10 units)
  let testVariantHaute = null; // High-ticket garment (₹65,000, 5 units - exceeds COD limit)
  let testCoupon = null;

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
    const password = 'OrderTestPass2026!';
    const passwordHash = await bcrypt.hash(password, 10);

    // 2. Provision Customer A
    customerA = await prisma.user.create({
      data: {
        name: 'Eleanor Vance',
        email: `eleanor.${timestamp}@forme.store`,
        passwordHash,
        role: 'CUSTOMER',
        isEmailVerified: true,
      },
    });

    const loginResA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerA.email, password });
    expect(loginResA.status).toBe(200);
    customerAToken = loginResA.body.data.accessToken;

    // 3. Provision Customer B (for isolation & ownership testing)
    customerB = await prisma.user.create({
      data: {
        name: 'Sebastian Croft',
        email: `sebastian.${timestamp}@forme.store`,
        passwordHash,
        role: 'CUSTOMER',
        isEmailVerified: true,
      },
    });

    const loginResB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerB.email, password });
    expect(loginResB.status).toBe(200);
    customerBToken = loginResB.body.data.accessToken;

    // 4. Provision Saved Address for Customer A
    savedAddressA = await prisma.address.create({
      data: {
        userId: customerA.id,
        recipientName: 'Eleanor Vance',
        phone: '+919876543210',
        addressLine1: 'Penthouse 12, Altamount Road',
        addressLine2: 'Cumballa Hill',
        landmark: 'Near Antilia',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400026',
        country: 'India',
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    });

    // 5. Provision Category & Products
    testCategory = await prisma.category.create({
      data: {
        name: `Couture Orders ${timestamp}`,
        slug: `couture-orders-${timestamp}`,
        description: 'Orders test luxury apparel',
        status: 'ACTIVE',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name: `Duchess Satin Cape ${timestamp}`,
        slug: `duchess-satin-cape-${timestamp}`,
        baseSku: `DSC-${timestamp}`,
        shortDescription: 'Luxury silk duchesse satin cape.',
        productType: 'Cape',
        categoryId: testCategory.id,
        sellingPrice: 15000.0,
        compareAtPrice: 18000.0,
        status: 'PUBLISHED',
        fabric: '100% Silk Duchesse Satin',
      },
    });

    testVariantA = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        sku: `DSC-${timestamp}-M`,
        colorName: 'Noir Midnight',
        colorHex: '#0F172A',
        size: 'M',
        stockQuantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10,
        status: 'ACTIVE',
      },
    });

    testProductHaute = await prisma.product.create({
      data: {
        name: `Gold Embroidered Gown ${timestamp}`,
        slug: `gold-embroidered-gown-${timestamp}`,
        baseSku: `GEG-${timestamp}`,
        shortDescription: 'Haute couture gold embroidered gown.',
        productType: 'Gown',
        categoryId: testCategory.id,
        sellingPrice: 65000.0,
        compareAtPrice: 75000.0,
        status: 'PUBLISHED',
        fabric: 'Gold Brocade Silk',
      },
    });

    testVariantHaute = await prisma.productVariant.create({
      data: {
        productId: testProductHaute.id,
        sku: `GEG-${timestamp}-L`,
        colorName: 'Imperial Gold',
        colorHex: '#D4AF37',
        size: 'L',
        stockQuantity: 5,
        reservedQuantity: 0,
        availableQuantity: 5,
        status: 'ACTIVE',
      },
    });

    // 6. Provision Promotional Coupon
    testCoupon = await prisma.coupon.create({
      data: {
        code: `LUXE${timestamp}`.slice(0, 15).toUpperCase(),
        description: 'Test Couture Discount',
        discountType: 'FLAT',
        discountValue: 1500.0,
        minPurchaseAmount: 10000.0,
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + 86400000),
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    // Cleanup generated test data
    try {
      if (customerA) {
        await prisma.order.deleteMany({ where: { userId: customerA.id } });
        await prisma.address.deleteMany({ where: { userId: customerA.id } });
        await prisma.cart.deleteMany({ where: { userId: customerA.id } });
        await prisma.user.delete({ where: { id: customerA.id } });
      }
      if (customerB) {
        await prisma.order.deleteMany({ where: { userId: customerB.id } });
        await prisma.user.delete({ where: { id: customerB.id } });
      }
      const productIds = [testProduct?.id, testProductHaute?.id].filter(Boolean);
      if (productIds.length > 0) {
        await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });
        await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      }
      if (testCategory) {
        await prisma.category.delete({ where: { id: testCategory.id } });
      }
      if (testCoupon) {
        await prisma.coupon.delete({ where: { id: testCoupon.id } });
      }
    } catch {
      // Ignore cleanup failures
    }
  });

  // ==========================================
  // 1. CHECKOUT & SERVER PRICING INTEGRATION
  // ==========================================
  describe('1. Checkout API & Server-Authoritative Pricing', () => {
    it('1.1 should create order via checkout with saved address and online payment (RAZORPAY_UPI)', async () => {
      // Add garment to customer A's cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ variantId: testVariantA.id, quantity: 1 });

      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          shippingAddressId: savedAddressA.id,
          useShippingForBilling: true,
          paymentMethod: 'RAZORPAY_UPI',
          customerNotes: 'Please ring bell upon delivery',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('orderId');
      expect(res.body.data).toHaveProperty('orderNumber');
      expect(res.body.data.orderStatus).toBe('PENDING');
      expect(res.body.data.paymentStatus).toBe('PENDING');
      expect(res.body.data.paymentMethod).toBe('RAZORPAY_UPI');
      expect(res.body.data.razorpay).toBeDefined();
      expect(res.body.data.razorpay.currency).toBe('INR');
      // ₹15,000 + 12% GST (₹1,800) = ₹16,800 = 1680000 paise
      expect(res.body.data.razorpay.amount).toBe(1680000);

      // Verify cart was cleared after checkout
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(cartRes.body.data.items.length).toBe(0);
    });

    it('1.2 should create order with direct buy-now item and inline address', async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: {
            variantId: testVariantA.id,
            quantity: 1,
          },
          shippingAddress: {
            recipientName: 'Eleanor Vance Vacation Villa',
            phone: '+919876543210',
            addressLine1: 'Villa 4, Candolim Beach Road',
            city: 'North Goa',
            state: 'Goa',
            postalCode: '403515',
            country: 'India',
          },
          useShippingForBilling: true,
          paymentMethod: 'RAZORPAY_CARD',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderStatus).toBe('PENDING');
      expect(res.body.data.razorpay).toBeDefined();
    });

    it('1.3 should apply promotional coupon and reduce order grand total correctly', async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: {
            variantId: testVariantA.id,
            quantity: 1,
          },
          shippingAddressId: savedAddressA.id,
          couponCode: testCoupon.code,
          paymentMethod: 'RAZORPAY_NETBANKING',
        });

      expect(res.status).toBe(201);
      // Item ₹15,000 - Coupon ₹1,500 = Subtotal ₹13,500 + 12% GST (₹1,620) = ₹15,120 = 1512000 paise
      expect(res.body.data.razorpay.amount).toBe(1512000);
    });

    it('1.4 should REJECT checkout with empty shopping bag', async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'RAZORPAY_UPI',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CART_EMPTY');
    });

    it('1.5 should REJECT unauthenticated checkout request', async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .send({
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'RAZORPAY_UPI',
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // 2. CASH ON DELIVERY (COD) LIFECYCLE
  // ==========================================
  describe('2. Cash on Delivery (COD) Dedicated Lifecycle', () => {
    let codOrder = null;

    it('2.1 should place and immediately confirm COD order within allowed amount threshold', async () => {
      const initialStock = await inventoryService.calculateAvailableStock(testVariantA.id);

      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: {
            variantId: testVariantA.id,
            quantity: 2,
          },
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'COD',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      codOrder = res.body.data;
      expect(codOrder.orderStatus).toBe('CONFIRMED');
      expect(codOrder.paymentStatus).toBe('PENDING');
      expect(codOrder.paymentMethod).toBe('COD');
      expect(codOrder.razorpay).toBeNull();

      // Verify physical stock was committed immediately for courier handover
      const stockAfterCOD = await inventoryService.calculateAvailableStock(testVariantA.id);
      expect(stockAfterCOD.availableStock).toBe(initialStock.availableStock - 2);
    });

    it('2.2 should REJECT COD when order total exceeds ₹50,000 threshold', async () => {
      // testVariantHaute is ₹65,000 (+ GST = ₹72,800), exceeding COD limit
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: {
            variantId: testVariantHaute.id,
            quantity: 1,
          },
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'COD',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('COD_AMOUNT_EXCEEDED');
    });

    it('2.3 should REJECT COD for destination addresses outside India', async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: {
            variantId: testVariantA.id,
            quantity: 1,
          },
          shippingAddress: {
            recipientName: 'Eleanor Vance Paris Flat',
            phone: '+33140205050',
            addressLine1: '12 Rue du Faubourg Saint-Honoré',
            city: 'Paris',
            state: 'Île-de-France',
            postalCode: '75008',
            country: 'France',
          },
          paymentMethod: 'COD',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('COD_UNAVAILABLE_LOCATION');
    });
  });

  // ==========================================
  // 3. RAZORPAY VERIFICATION & CRYPTOGRAPHIC SECURITY
  // ==========================================
  describe('3. Razorpay Payments & HMAC Signature Verification', () => {
    let pendingOrder = null;
    let razorpayOrderId = null;

    beforeAll(async () => {
      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: {
            variantId: testVariantA.id,
            quantity: 1,
          },
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'RAZORPAY_UPI',
        });
      expect(checkoutRes.status).toBe(201);
      pendingOrder = checkoutRes.body.data;
      razorpayOrderId = pendingOrder.razorpay.orderId;
    }, 45000);

    it('3.1 should REJECT verification when HMAC signature is forged or mismatched', async () => {
      const res = await request(app)
        .post('/api/v1/orders/verify-payment')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: pendingOrder.orderId,
          razorpayOrderId,
          razorpayPaymentId: 'pay_tampered_12345',
          razorpaySignature: 'forged_invalid_signature_hex_code_1234567890abcdef',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PAYMENT_SIGNATURE_MISMATCH');

      // Verify order paymentStatus transitioned to FAILED
      const order = await prisma.order.findUnique({ where: { id: pendingOrder.orderId } });
      expect(order.paymentStatus).toBe('FAILED');
    });

    it('3.2 should CONFIRM order and CAPTURE payment when HMAC signature is mathematically valid', async () => {
      const validPaymentId = `pay_${Date.now()}`;
      const validSignature = razorpayUtil.generateTestSignature(razorpayOrderId, validPaymentId);

      const res = await request(app)
        .post('/api/v1/orders/verify-payment')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: pendingOrder.orderId,
          razorpayOrderId,
          razorpayPaymentId: validPaymentId,
          razorpaySignature: validSignature,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.paymentStatus).toBe('CAPTURED');

      // Verify DB state
      const dbOrder = await prisma.order.findUnique({
        where: { id: pendingOrder.orderId },
        include: { payments: true },
      });
      expect(dbOrder.orderStatus).toBe('CONFIRMED');
      expect(dbOrder.paymentStatus).toBe('CAPTURED');
      expect(dbOrder.payments[0].status).toBe('CAPTURED');
      expect(dbOrder.payments[0].razorpayPaymentId).toBe(validPaymentId);
    });

    it('3.3 should be idempotent and handle duplicate payment verification without double commit', async () => {
      const validPaymentId = `pay_${Date.now()}`;
      const validSignature = razorpayUtil.generateTestSignature(razorpayOrderId, validPaymentId);

      const res = await request(app)
        .post('/api/v1/orders/verify-payment')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: pendingOrder.orderId,
          razorpayOrderId,
          razorpayPaymentId: validPaymentId,
          razorpaySignature: validSignature,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('already verified');
    });

    it('3.4 should record payment failure callback properly', async () => {
      const newOrderRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: { variantId: testVariantA.id, quantity: 1 },
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'RAZORPAY_CARD',
        });
      const orderToFail = newOrderRes.body.data;

      const failRes = await request(app)
        .post('/api/v1/orders/payment-failure')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: orderToFail.orderId,
          razorpayOrderId: orderToFail.razorpay.orderId,
          failureReason: 'User bank declined international transaction',
        });

      expect(failRes.status).toBe(200);
      const updatedOrder = await prisma.order.findUnique({ where: { id: orderToFail.orderId } });
      expect(updatedOrder.paymentStatus).toBe('FAILED');
    });
  });

  // ==========================================
  // 4. RAZORPAY RAW BODY WEBHOOK LISTENER
  // ==========================================
  describe('4. Razorpay Webhooks (Raw Body HMAC Verification)', () => {
    let webhookOrder = null;
    let rzpOrderId = null;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: { variantId: testVariantA.id, quantity: 1 },
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'RAZORPAY_UPI',
        });
      webhookOrder = res.body.data;
      rzpOrderId = webhookOrder.razorpay.orderId;
    }, 45000);

    it('4.1 should REJECT webhook with invalid signature', async () => {
      const payload = {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_wh_123', order_id: rzpOrderId } } },
      };

      const res = await request(app)
        .post('/api/v1/orders/webhook')
        .set('x-razorpay-signature', 'bogus_signature_123')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('WEBHOOK_SIGNATURE_MISMATCH');
    });

    it('4.2 should process valid payment.captured webhook and confirm order asynchronously', async () => {
      const paymentId = `pay_wh_${Date.now()}`;
      const payloadObj = {
        event: 'payment.captured',
        id: `evt_${Date.now()}`,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: rzpOrderId,
              status: 'captured',
            },
          },
        },
      };

      const rawJson = JSON.stringify(payloadObj);
      const validSignature = razorpayUtil.generateTestWebhookSignature(rawJson);

      const res = await request(app)
        .post('/api/v1/orders/webhook')
        .set('x-razorpay-signature', validSignature)
        .set('Content-Type', 'application/json')
        .send(rawJson);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');

      // Verify DB order was confirmed
      const order = await prisma.order.findUnique({ where: { id: webhookOrder.orderId } });
      expect(order.paymentStatus).toBe('CAPTURED');
      expect(order.orderStatus).toBe('CONFIRMED');
    });
  });

  // ==========================================
  // 5. ORDER LIFECYCLE & STATE MACHINE TRANSITIONS
  // ==========================================
  describe('5. Order Lifecycle & Allowed State Transitions', () => {
    let lifecycleOrder = null;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: { variantId: testVariantA.id, quantity: 1 },
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'COD',
        });
      lifecycleOrder = res.body.data;
    }, 45000);

    it('5.1 should progress order through valid statuses: CONFIRMED -> PROCESSING -> PACKED', async () => {
      // 1. Transition to PROCESSING
      const resProc = await request(app)
        .patch(`/api/v1/admin/orders/${lifecycleOrder.orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PROCESSING', comment: 'Pattern cutting and seam inspection in progress' });
      expect(resProc.status).toBe(200);
      expect(resProc.body.data.orderStatus).toBe('PROCESSING');

      // 2. Transition to PACKED
      const resPacked = await request(app)
        .patch(`/api/v1/admin/orders/${lifecycleOrder.orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PACKED', comment: 'Enclosed in archival garment box' });
      expect(resPacked.status).toBe(200);
      expect(resPacked.body.data.orderStatus).toBe('PACKED');
    });

    it('5.2 should REJECT illegal state transition (e.g. PACKED -> RETURNED)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/orders/${lifecycleOrder.orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RETURNED' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('5.3 should dispatch shipment: PACKED -> SHIPPED with tracking registration', async () => {
      const trackingNumber = `BLUEDART-${Date.now()}`;
      const res = await request(app)
        .post(`/api/v1/admin/orders/${lifecycleOrder.orderId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          carrier: 'Blue Dart Express',
          trackingNumber,
          trackingUrl: `https://bluedart.com/track/${trackingNumber}`,
          estimatedDeliveryAt: new Date(Date.now() + 172800000).toISOString(),
          comment: 'Handed over to Blue Dart priority courier',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.trackingNumber).toBe(trackingNumber);

      const dbOrder = await prisma.order.findUnique({ where: { id: lifecycleOrder.orderId } });
      expect(dbOrder.orderStatus).toBe('SHIPPED');
    });

    it('5.4 should prevent customer from cancelling once order is SHIPPED', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${lifecycleOrder.orderId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Changed mind, want different size' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ORDER_NOT_CANCELLABLE');
    });

    it('5.5 should complete delivery: SHIPPED -> DELIVERED', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/orders/${lifecycleOrder.orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DELIVERED', comment: 'Signed and delivered at destination' });

      expect(res.status).toBe(200);
      expect(res.body.data.orderStatus).toBe('DELIVERED');
    });

    it('5.6 should allow customer to request return for DELIVERED order within 14 days', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${lifecycleOrder.orderId}/return`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Sleeve drape does not match desired silhouette' });

      expect(res.status).toBe(200);
      expect(res.body.data.orderStatus).toBe('RETURN_REQUESTED');
    });

    it('5.7 should allow admin to approve return and restock garments into active warehouse inventory', async () => {
      const stockBeforeReturn = await inventoryService.calculateAvailableStock(testVariantA.id);

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${lifecycleOrder.orderId}/return-action`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE', reason: 'Garment inspected in original condition with security tags intact', restockItems: true });

      expect(res.status).toBe(200);
      expect(res.body.data.orderStatus).toBe('RETURN_APPROVED');

      // Verify inventory was restored
      const stockAfterReturn = await inventoryService.calculateAvailableStock(testVariantA.id);
      expect(stockAfterReturn.availableStock).toBe(stockBeforeReturn.availableStock + 1);
    });
  });

  // ==========================================
  // 6. ORDER CANCELLATION & INVENTORY RESTORATION
  // ==========================================
  describe('6. Order Cancellation & Stock Restoration', () => {
    it('6.1 should cancel eligible order and restore physical stock to circulation', async () => {
      // 1. Place order
      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: { variantId: testVariantA.id, quantity: 2 },
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'COD',
        });
      const order = checkoutRes.body.data;

      const stockBeforeCancel = await inventoryService.calculateAvailableStock(testVariantA.id);

      // 2. Customer cancels order
      const cancelRes = await request(app)
        .post(`/api/v1/orders/${order.orderId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Accidental duplicate placement' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.orderStatus).toBe('CANCELLED');

      // 3. Verify stock restored
      const stockAfterCancel = await inventoryService.calculateAvailableStock(testVariantA.id);
      expect(stockAfterCancel.availableStock).toBe(stockBeforeCancel.availableStock + 2);
    });
  });

  // ==========================================
  // 7. ORDER HISTORY, SECURITY & INVOICES
  // ==========================================
  describe('7. Order History, Invoices & Administrative Access Controls', () => {
    let orderAId = null;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: { variantId: testVariantA.id, quantity: 1 },
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'COD',
        });
      orderAId = res.body.data.orderId;
    }, 45000);

    it('7.1 should list customer orders with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/orders?page=1&limit=5')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('7.2 should retrieve full order details for authorized owner', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(orderAId);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.shippingAddressSnapshot.city).toBe('Mumbai');
    });

    it('7.3 should REJECT Customer B from inspecting Customer A order (Ownership Security)', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_RESOURCE');
    });

    it('7.4 should retrieve order tracking timeline', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}/track`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('orderNumber');
      expect(res.body.data).toHaveProperty('timeline');
      expect(res.body.data.timeline.length).toBeGreaterThanOrEqual(1);
    });

    it('7.5 should generate luxury tax invoice as JSON', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}/invoice`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('invoiceNumber');
      expect(res.body.data.seller.name).toContain('FORME');
      expect(res.body.data.financialSummary.grandTotal).toBeGreaterThan(0);
    });

    it('7.6 should generate luxury tax invoice as HTML document', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}/invoice?format=html`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('TAX INVOICE');
      expect(res.text).toContain('FORME');
    });

    it('7.7 should allow admin to add internal notes to order history', async () => {
      const note = 'Client requested discreet plain packaging without exterior logo';
      const res = await request(app)
        .post(`/api/v1/admin/orders/${orderAId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: note });

      expect(res.status).toBe(200);
      const dbOrder = await prisma.order.findUnique({
        where: { id: orderAId },
        include: { statusHistory: true },
      });
      expect(dbOrder.adminNotes).toBe(note);
      expect(dbOrder.statusHistory.some((h) => h.comment.includes(note))).toBe(true);
    });

    it('7.8 should allow admin to process online refund for paid order', async () => {
      // Create a paid order to refund
      const checkoutRes = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          directCheckoutItem: { variantId: testVariantA.id, quantity: 1 },
          shippingAddressId: savedAddressA.id,
          paymentMethod: 'RAZORPAY_UPI',
        });
      const order = checkoutRes.body.data;

      // Verify payment
      const paymentId = `pay_rfnd_${Date.now()}`;
      await request(app)
        .post('/api/v1/orders/verify-payment')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          orderId: order.orderId,
          razorpayOrderId: order.razorpay.orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: razorpayUtil.generateTestSignature(order.razorpay.orderId, paymentId),
        });

      // Admin processes refund
      const refundRes = await request(app)
        .post(`/api/v1/admin/orders/${order.orderId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Concierge goodwill refund' });

      expect(refundRes.status).toBe(200);
      expect(refundRes.body.data.status).toBe('PROCESSED');

      const refundedOrder = await prisma.order.findUnique({ where: { id: order.orderId } });
      expect(refundedOrder.paymentStatus).toBe('REFUNDED');
    });

    it('7.9 should REJECT non-admin customer from administrative order endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_RESOURCE');
    });
  });
});
