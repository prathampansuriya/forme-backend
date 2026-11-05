import crypto from 'crypto';
import prisma from '../config/prisma.config.js';
import env from '../config/env.config.js';
import { logger } from '../config/logger.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import razorpayUtil from '../utils/razorpay.util.js';
import pricingService from './pricing.service.js';
import inventoryService from './inventory.service.js';
import emailService from './email.service.js';
import { generateInvoiceData, generateInvoiceHtml } from '../utils/invoice.util.js';

export const ALLOWED_STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURN_APPROVED', 'DELIVERED'],
  RETURN_APPROVED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const MAX_COD_AMOUNT = 50000; // ₹50,000 maximum order limit for Cash on Delivery

class OrderService {
  /**
   * Formats an order entity so all legacy email templates have consistent field access.
   */
  formatOrderForEmail(order) {
    if (!order) return order;
    return {
      ...order,
      totalAmount: Number(order.grandTotal),
      subtotal: Number(order.itemSubtotal),
      taxAmount: Number(order.tax),
      shippingCost: Number(order.shipping),
      discountAmount:
        Number(order.offerDiscount || 0) + Number(order.flashSaleDiscount || 0) + Number(order.couponDiscount || 0),
    };
  }

  /**
   * Generates a luxury order reference: FRM-YYYYMMDD-XXXX
   */
  generateOrderNumber() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
    return `FRM-${dateStr}-${randomSuffix}`;
  }

  /**
   * Validates state machine status transitions.
   */
  validateStatusTransition(currentStatus, newStatus) {
    if (currentStatus === newStatus) return true;

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      throw ApplicationError.badRequest(
        `Invalid order status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedNext.join(', ') || 'None (Terminal state)'}`,
        'INVALID_STATUS_TRANSITION'
      );
    }
    return true;
  }

  /**
   * 1. Core Checkout & Order Creation
   */
  async checkout({
    userId,
    cartId = null,
    shippingAddressId = null,
    shippingAddress = null,
    billingAddressId = null,
    billingAddress = null,
    useShippingForBilling = true,
    paymentMethod,
    customerNotes = null,
    directCheckoutItem = null,
    couponCode = null,
    checkoutSessionId = null,
  }) {
    if (!userId) {
      throw ApplicationError.unauthorized('Authenticated user required to checkout');
    }

    // 1. Resolve & Validate Shipping and Billing Addresses
    let shippingSnapshot = null;
    let billingSnapshot = null;

    if (shippingAddressId) {
      const dbAddr = await prisma.address.findUnique({
        where: { id: shippingAddressId },
      });
      if (!dbAddr || dbAddr.userId !== userId) {
        throw ApplicationError.forbidden('Shipping address not found or belongs to another user', 'FORBIDDEN_RESOURCE');
      }
      shippingSnapshot = {
        recipientName: dbAddr.recipientName,
        phone: dbAddr.phone,
        addressLine1: dbAddr.addressLine1,
        addressLine2: dbAddr.addressLine2,
        landmark: dbAddr.landmark,
        city: dbAddr.city,
        state: dbAddr.state,
        postalCode: dbAddr.postalCode,
        country: dbAddr.country || 'India',
      };
    } else if (shippingAddress) {
      shippingSnapshot = {
        recipientName: shippingAddress.recipientName,
        phone: shippingAddress.phone,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || null,
        landmark: shippingAddress.landmark || null,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country || 'India',
      };
    } else {
      throw ApplicationError.badRequest('Shipping address is required');
    }

    if (useShippingForBilling) {
      billingSnapshot = { ...shippingSnapshot };
    } else if (billingAddressId) {
      const dbAddr = await prisma.address.findUnique({
        where: { id: billingAddressId },
      });
      if (!dbAddr || dbAddr.userId !== userId) {
        throw ApplicationError.forbidden('Billing address not found or belongs to another user', 'FORBIDDEN_RESOURCE');
      }
      billingSnapshot = {
        recipientName: dbAddr.recipientName,
        phone: dbAddr.phone,
        addressLine1: dbAddr.addressLine1,
        addressLine2: dbAddr.addressLine2,
        landmark: dbAddr.landmark,
        city: dbAddr.city,
        state: dbAddr.state,
        postalCode: dbAddr.postalCode,
        country: dbAddr.country || 'India',
      };
    } else if (billingAddress) {
      billingSnapshot = {
        recipientName: billingAddress.recipientName,
        phone: billingAddress.phone,
        addressLine1: billingAddress.addressLine1,
        addressLine2: billingAddress.addressLine2 || null,
        landmark: billingAddress.landmark || null,
        city: billingAddress.city,
        state: billingAddress.state,
        postalCode: billingAddress.postalCode,
        country: billingAddress.country || 'India',
      };
    } else {
      billingSnapshot = { ...shippingSnapshot };
    }

    // 2. Resolve Items for Checkout
    let checkoutItems = [];
    let sourceCart = null;

    if (directCheckoutItem) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: directCheckoutItem.variantId },
        include: {
          media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 },
          product: {
            include: {
              category: true,
              media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 5 },
            },
          },
        },
      });

      if (!variant) {
        throw ApplicationError.notFound(`Variant ${directCheckoutItem.variantId} not found`, 'VARIANT_NOT_FOUND');
      }
      if (variant.status !== 'ACTIVE' || variant.product.status !== 'PUBLISHED') {
        throw ApplicationError.badRequest('The requested garment is currently unavailable', 'PRODUCT_UNAVAILABLE');
      }

      checkoutItems = [
        {
          id: `direct_${variant.id}`,
          variantId: variant.id,
          quantity: directCheckoutItem.quantity || 1,
          variant,
        },
      ];
    } else {
      // From cart
      const cartQuery = cartId ? { id: cartId } : { userId };
      sourceCart = await prisma.cart.findFirst({
        where: cartQuery,
        include: {
          items: {
            include: {
              variant: {
                include: {
                  media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 },
                  product: {
                    include: {
                      category: true,
                      media: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 5 },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!sourceCart || !sourceCart.items || sourceCart.items.length === 0) {
        throw ApplicationError.badRequest('Your shopping bag is empty. Please add garments before checking out.', 'CART_EMPTY');
      }

      // Check all items
      for (const item of sourceCart.items) {
        if (!item.variant || item.variant.status !== 'ACTIVE' || !item.variant.product || item.variant.product.status !== 'PUBLISHED') {
          throw ApplicationError.badRequest(
            `Garment item "${item.variant?.product?.name || item.variant?.product?.title || 'Selected variant'}" is currently unavailable.`,
            'PRODUCT_UNAVAILABLE'
          );
        }
      }

      checkoutItems = sourceCart.items;
      if (!couponCode && sourceCart.couponCode) {
        couponCode = sourceCart.couponCode;
      }
    }

    // 3. Server-Authoritative Pricing Recalculation (Zero Client-Side Trust)
    const pricingItems = checkoutItems.map((item) => ({
      variantId: item.variant.id,
      quantity: item.quantity,
      price: Number(item.variant.priceOverride || item.variant.product.sellingPrice),
      compareAtPrice: Number(item.variant.compareAtPriceOverride || item.variant.product.compareAtPrice || item.variant.priceOverride || item.variant.product.sellingPrice),
      variant: item.variant,
      product: item.variant.product,
    }));

    const calculatedPricing = await pricingService.calculateCartPricing({
      items: pricingItems,
      couponCode,
      customerId: userId,
      stateCode: shippingSnapshot.state,
      shippingState: shippingSnapshot.state,
      shippingAddress: shippingSnapshot,
    });

    const grandTotal = Number(calculatedPricing.finalPayableAmount ?? calculatedPricing.finalPayable ?? 0);
    const itemSubtotal = Number(calculatedPricing.baseSellingSubtotal ?? calculatedPricing.sellingSubtotal ?? 0);
    const mrpSubtotal = Number(calculatedPricing.mrpSubtotal ?? 0);
    const offerDiscount = Number(calculatedPricing.offerDiscount ?? calculatedPricing.promotionalDiscount ?? 0);
    const flashSaleDiscount = Number(calculatedPricing.flashSaleDiscount ?? 0);
    const couponDiscount = Number(calculatedPricing.couponDiscount ?? 0);
    const tax = Number(calculatedPricing.tax ?? calculatedPricing.taxAmount ?? 0);
    const shipping = Number(calculatedPricing.shippingCharge ?? calculatedPricing.shippingFee ?? 0);

    // 4. Validate Payment Method & COD Restrictions
    const isCOD = paymentMethod === 'COD';
    if (isCOD) {
      if (grandTotal > MAX_COD_AMOUNT) {
        throw ApplicationError.badRequest(
          `Cash on Delivery is only available for orders up to ₹${MAX_COD_AMOUNT.toLocaleString('en-IN')}. Please select an online payment method.`,
          'COD_AMOUNT_EXCEEDED'
        );
      }
      if (shippingSnapshot.country && shippingSnapshot.country.toLowerCase() !== 'india') {
        throw ApplicationError.badRequest('Cash on Delivery is only available within India.', 'COD_UNAVAILABLE_LOCATION');
      }
    }

    // 5. Stock Reservation & Availability Check
    const reservationItems = checkoutItems.map((item) => ({
      variantId: item.variant.id,
      quantity: item.quantity,
    }));

    // Generate unique session id if none provided
    const sessionKey = checkoutSessionId || `chk_${crypto.randomBytes(12).toString('hex')}`;

    // Atomically reserve stock (or verify available stock)
    const reservationResult = await inventoryService.createReservation({
      items: reservationItems,
      userId,
      cartId: sourceCart ? sourceCart.id : null,
      checkoutSessionId: sessionKey,
      ttlMinutes: 15,
    });

    // 6. Generate Razorpay Order if online payment
    let razorpayOrder = null;
    const orderNumber = this.generateOrderNumber();

    if (!isCOD) {
      razorpayOrder = await razorpayUtil.createRazorpayOrder({
        amount: Math.round(grandTotal * 100), // paise
        currency: 'INR',
        receipt: orderNumber,
        notes: {
          userId,
          orderNumber,
          customerName: shippingSnapshot.recipientName,
        },
      });
    }

    // 7. Atomic Order Creation in Database
    const initialOrderStatus = isCOD ? 'CONFIRMED' : 'PENDING';
    const initialPaymentStatus = 'PENDING';

    const order = await prisma.$transaction(async (tx) => {
      // Create Master Order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          shippingAddressSnapshot: shippingSnapshot,
          billingAddressSnapshot: billingSnapshot,
          itemSubtotal,
          mrpSubtotal,
          offerDiscount,
          flashSaleDiscount,
          couponDiscount,
          tax,
          shipping,
          grandTotal,
          currency: 'INR',
          paymentMethod,
          paymentStatus: initialPaymentStatus,
          orderStatus: initialOrderStatus,
          couponId: calculatedPricing.appliedCoupon ? calculatedPricing.appliedCoupon.id : null,
          appliedCouponSnapshot: calculatedPricing.appliedCoupon || null,
          appliedPromotionSnapshot: calculatedPricing.appliedPromotions || null,
          pricingBreakdown: calculatedPricing,
          customerNotes,
        },
      });

      // Create Order Items with Immutable Snapshots
      for (let idx = 0; idx < checkoutItems.length; idx++) {
        const item = checkoutItems[idx];
        const calcItem =
          calculatedPricing.items?.find((ci) => ci.variantId === item.variant.id) ||
          calculatedPricing.items?.[idx];

        const variantImg =
          item.variant.media?.[0]?.secureUrl ||
          item.variant.media?.[0]?.thumbnailUrl ||
          item.variant.media?.[0]?.url;
        const productImg =
          item.variant.product?.media?.find((m) => m.isPrimary)?.secureUrl ||
          item.variant.product?.media?.[0]?.secureUrl ||
          item.variant.product?.media?.[0]?.thumbnailUrl ||
          item.variant.product?.media?.[0]?.url;

        const primaryImage =
          variantImg ||
          productImg ||
          item.variant.imageUrl ||
          '/placeholder-garment.jpg';

        const unitSelling = Number(calcItem?.unitSellingPrice ?? item.variant.priceOverride ?? item.variant.product.sellingPrice);
        const compareAt = Number(calcItem?.mrp ?? item.variant.compareAtPriceOverride ?? item.variant.product.compareAtPrice ?? unitSelling);
        const lineTotal = Number(calcItem?.finalItemAmount ?? (unitSelling * item.quantity));
        const lineTax = Number(calcItem?.lineTax ?? 0);
        const lineDiscount =
          Number(calcItem?.lineOfferDiscount || 0) +
          Number(calcItem?.lineFlashSaleDiscount || 0) +
          Number(calcItem?.lineCouponDiscount || 0);

        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.variant.productId,
            variantId: item.variant.id,
            productName: item.variant.product.name || item.variant.product.title || 'Haute Couture Garment',
            productSlug: item.variant.product.slug,
            sku: item.variant.sku,
            variantDetails: {
              fabric: item.variant.fabric || item.variant.product.fabric || 'Luxury Silk Blend',
              careInstructions: item.variant.careInstructions || item.variant.product.careInstructions || 'Dry Clean Only',
              colorName: item.variant.colorName || 'Default',
              colorHex: item.variant.colorHex || '#1C1917',
              size: item.variant.size || 'M',
              appliedPromotion: calcItem?.appliedPromotion || null,
              pricing: {
                mrp: compareAt,
                baseSellingPrice: Number(calcItem?.baseSellingPrice || unitSelling),
                unitSellingPrice: unitSelling,
                lineOfferDiscount: Number(calcItem?.lineOfferDiscount || 0),
                lineFlashSaleDiscount: Number(calcItem?.lineFlashSaleDiscount || 0),
                lineCouponDiscount: Number(calcItem?.lineCouponDiscount || 0),
                lineTax,
                lineTotal,
              },
            },
            selectedSize: item.variant.size || 'M',
            selectedColor: item.variant.colorName || 'Black',
            productImage: item.variant.imageUrl || primaryImage,
            quantity: item.quantity,
            unitSellingPrice: unitSelling,
            compareAtPrice: compareAt,
            applicableDiscount: lineDiscount,
            tax: lineTax,
            finalItemAmount: lineTotal,
          },
        });
      }

      // Create Address Snapshot Record
      await tx.orderAddressSnapshot.create({
        data: {
          orderId: newOrder.id,
          recipientName: shippingSnapshot.recipientName,
          phone: shippingSnapshot.phone,
          addressLine1: shippingSnapshot.addressLine1,
          addressLine2: shippingSnapshot.addressLine2,
          landmark: shippingSnapshot.landmark,
          city: shippingSnapshot.city,
          state: shippingSnapshot.state,
          postalCode: shippingSnapshot.postalCode,
          country: shippingSnapshot.country || 'India',
        },
      });

      // Create Initial Status History Record
      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          previousStatus: null,
          newStatus: initialOrderStatus,
          comment: isCOD
            ? 'Cash on Delivery order placed and confirmed.'
            : 'Checkout initiated, awaiting online payment authorization.',
          changedByUserId: userId,
        },
      });

      // Link reservations to order
      await tx.inventoryReservation.updateMany({
        where: { checkoutSessionId: sessionKey, status: 'ACTIVE' },
        data: { orderId: newOrder.id },
      });

      // If Razorpay, create initial Payment record
      if (!isCOD && razorpayOrder) {
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            razorpayOrderId: razorpayOrder.id,
            amount: grandTotal,
            currency: 'INR',
            method: paymentMethod,
            status: 'PENDING',
          },
        });
      }

      // If coupon used, record usage
      if (calculatedPricing.appliedCoupon) {
        await tx.promotionUsage.create({
          data: {
            userId,
            orderId: newOrder.id,
            couponId: calculatedPricing.appliedCoupon.id,
            discountAmountCaptured: couponDiscount,
          },
        });

        await tx.coupon.update({
          where: { id: calculatedPricing.appliedCoupon.id },
          data: { timesRedeemed: { increment: 1 } },
        });
      }

      // Clear cart items if checked out from cart
      if (sourceCart) {
        await tx.cartItem.deleteMany({
          where: { cartId: sourceCart.id },
        });
        await tx.cart.update({
          where: { id: sourceCart.id },
          data: { couponCode: null },
        });
      }

      return newOrder;
    });

    // 8. For COD: Immediately commit stock (dedicated courier transit commitment)
    if (isCOD) {
      await inventoryService.commitReservation({
        orderId: order.id,
        checkoutSessionId: sessionKey,
        paymentMethod: 'COD',
      });

      // Send COD Order Confirmation Email asynchronously
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (user && user.email) {
        const orderWithItems = await this.getOrderDetails({ orderId: order.id, userId, role: 'CUSTOMER' });
        emailService
          .sendCodOrderConfirmationEmail(user.email, {
            customerName: user.name || shippingSnapshot.recipientName,
            order: this.formatOrderForEmail(orderWithItems),
            confirmationUrl: `${env.CLIENT_URL}/account/orders/${order.id}`,
            userId,
          })
          .catch((err) => logger.warn(`[EMAIL] Failed to dispatch COD confirmation: ${err.message}`));
      }
    }

    logger.info(`[ORDER] Created Order ${order.orderNumber} (${paymentMethod}, Total: ₹${grandTotal})`);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod,
      grandTotal,
      currency: 'INR',
      razorpay: razorpayOrder
        ? {
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: razorpayUtil.keyId,
          }
        : null,
      checkoutSessionId: sessionKey,
    };
  }

  /**
   * 2. Cryptographic Payment Verification (HMAC-SHA256)
   */
  async verifyPayment({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, userId = null }) {
    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw ApplicationError.badRequest('Missing required payment verification parameters');
    }

    // 1. Fetch Order & Payment Record
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (userId && order.userId !== userId) {
      throw ApplicationError.forbidden('Unauthorized access to this order', 'FORBIDDEN_RESOURCE');
    }

    // 2. Idempotency Check: If already confirmed and captured, return success immediately
    if (order.paymentStatus === 'CAPTURED' && order.orderStatus !== 'PENDING') {
      logger.info(`[PAYMENT IDEMPOTENCY] Order ${order.orderNumber} already captured. Skipping redundant verification.`);
      return {
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        paymentStatus: order.paymentStatus,
        message: 'Payment was already verified and captured successfully.',
      };
    }

    // 3. Cryptographically Verify Signature
    const isValid = razorpayUtil.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      // Record payment failure
      await prisma.payment.updateMany({
        where: { orderId: order.id, razorpayOrderId },
        data: {
          status: 'FAILED',
          failureReason: 'Cryptographic signature mismatch (HMAC-SHA256 verification failed)',
        },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'FAILED' },
      });

      throw ApplicationError.badRequest(
        'Payment signature verification failed. Possible tampering detected.',
        'PAYMENT_SIGNATURE_MISMATCH'
      );
    }

    // 4. Update Payment & Order Status in Transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update Payment
      await tx.payment.updateMany({
        where: { orderId: order.id, razorpayOrderId },
        data: {
          razorpayPaymentId,
          razorpaySignature,
          status: 'CAPTURED',
          capturedAt: new Date(),
        },
      });

      // Update Order
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'CAPTURED',
          orderStatus: 'CONFIRMED',
        },
      });

      // Add Status History
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.orderStatus,
          newStatus: 'CONFIRMED',
          comment: `Payment captured successfully via Razorpay (Payment ID: ${razorpayPaymentId})`,
          changedByUserId: userId || order.userId,
        },
      });

      return updated;
    });

    // 5. Commit Stock Reservation Permanently
    await inventoryService.commitReservation({
      orderId: order.id,
      paymentMethod: order.paymentMethod,
    });

    // 6. Trigger Transactional Notification Emails Asynchronously
    if (order.user && order.user.email) {
      const fullOrder = await this.getOrderDetails({ orderId: order.id, userId: order.userId, role: 'CUSTOMER' });
      const primaryPayment = fullOrder.payments?.[0] || { id: razorpayPaymentId };

      emailService
        .sendPaymentSuccessfulEmail(order.user.email, {
          customerName: order.user.name || fullOrder.shippingAddressSnapshot.recipientName,
          order: this.formatOrderForEmail(fullOrder),
          payment: primaryPayment,
          userId: order.userId,
        })
        .catch((err) => logger.warn(`[EMAIL] Failed to dispatch payment success email: ${err.message}`));

      emailService
        .sendOrderConfirmationEmail(order.user.email, {
          customerName: order.user.name || fullOrder.shippingAddressSnapshot.recipientName,
          order: this.formatOrderForEmail(fullOrder),
          orderItems: fullOrder.items,
          shippingAddress: fullOrder.shippingAddressSnapshot,
          userId: order.userId,
        })
        .catch((err) => logger.warn(`[EMAIL] Failed to dispatch order confirmation email: ${err.message}`));
    }

    logger.info(`[PAYMENT VERIFIED] Order ${order.orderNumber} successfully paid via Razorpay (${razorpayPaymentId})`);

    return {
      success: true,
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.orderStatus,
      paymentStatus: updatedOrder.paymentStatus,
      message: 'Payment verified and order confirmed successfully.',
    };
  }

  /**
   * 3. Handle Client Payment Failure Callback
   */
  async handlePaymentFailure({ orderId, razorpayOrderId = null, failureReason = 'Payment failed or cancelled', userId = null }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (userId && order.userId !== userId) {
      throw ApplicationError.forbidden('Unauthorized access', 'FORBIDDEN_RESOURCE');
    }

    await prisma.payment.updateMany({
      where: {
        orderId: order.id,
        ...(razorpayOrderId ? { razorpayOrderId } : {}),
      },
      data: {
        status: 'FAILED',
        failureReason,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED' },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.orderStatus,
        newStatus: order.orderStatus,
        comment: `Payment attempt failed: ${failureReason}`,
        changedByUserId: userId || order.userId,
      },
    });

    if (order.user && order.user.email) {
      emailService
        .sendPaymentFailedEmail(order.user.email, {
          customerName: order.user.name || 'Valued Clientele',
          order: this.formatOrderForEmail(order),
          payment: { failureReason },
          retryUrl: `${env.CLIENT_URL}/checkout?retryOrder=${order.id}`,
          userId: order.userId,
        })
        .catch((err) => logger.warn(`[EMAIL] Failed to dispatch payment failure alert: ${err.message}`));
    }

    return {
      success: true,
      message: 'Payment failure recorded successfully.',
      orderId: order.id,
    };
  }

  /**
   * 4. Razorpay Webhook Processing (Raw Body HMAC Verification)
   */
  async handleRazorpayWebhook({ rawBody, signature, eventPayload }) {
    // 1. Verify Webhook Signature using raw body
    const isValid = razorpayUtil.verifyWebhookSignature({
      rawBody,
      signature,
    });

    if (!isValid) {
      throw ApplicationError.badRequest('Invalid webhook signature', 'WEBHOOK_SIGNATURE_MISMATCH');
    }

    const event = eventPayload.event;
    const payload = eventPayload.payload || {};
    const eventId = eventPayload.id || `evt_${Date.now()}`;

    logger.info(`[RAZORPAY WEBHOOK] Received event "${event}" (Event ID: ${eventId})`);

    // 2. Dispatch by Event Type
    switch (event) {
      case 'order.paid':
      case 'payment.captured': {
        const paymentEntity = payload.payment?.entity || {};
        const razorpayOrderId = paymentEntity.order_id || payload.order?.entity?.id;
        const razorpayPaymentId = paymentEntity.id;

        if (!razorpayOrderId) break;

        const paymentRecord = await prisma.payment.findFirst({
          where: { razorpayOrderId },
          include: { order: true },
        });

        if (paymentRecord && paymentRecord.order) {
          const order = paymentRecord.order;
          if (order.paymentStatus !== 'CAPTURED') {
            await prisma.$transaction(async (tx) => {
              await tx.payment.update({
                where: { id: paymentRecord.id },
                data: {
                  razorpayPaymentId: razorpayPaymentId || paymentRecord.razorpayPaymentId,
                  status: 'CAPTURED',
                  capturedAt: new Date(),
                },
              });

              await tx.order.update({
                where: { id: order.id },
                data: {
                  paymentStatus: 'CAPTURED',
                  orderStatus: 'CONFIRMED',
                },
              });

              await tx.orderStatusHistory.create({
                data: {
                  orderId: order.id,
                  previousStatus: order.orderStatus,
                  newStatus: 'CONFIRMED',
                  comment: `Asynchronous payment confirmation received via Razorpay Webhook (${event})`,
                  changedByUserId: null,
                },
              });
            });

            // Commit stock
            await inventoryService.commitReservation({
              orderId: order.id,
              paymentMethod: order.paymentMethod,
            });

            logger.info(`[WEBHOOK SUCCESS] Order ${order.orderNumber} confirmed via Webhook`);
          }
        }
        break;
      }

      case 'payment.failed': {
        const paymentEntity = payload.payment?.entity || {};
        const razorpayOrderId = paymentEntity.order_id;
        if (!razorpayOrderId) break;

        await prisma.payment.updateMany({
          where: { razorpayOrderId },
          data: {
            status: 'FAILED',
            failureReason: paymentEntity.error_description || 'Gateway reported transaction failure',
          },
        });
        break;
      }

      case 'refund.processed': {
        const refundEntity = payload.refund?.entity || {};
        const razorpayRefundId = refundEntity.id;
        if (razorpayRefundId) {
          await prisma.refund.updateMany({
            where: { razorpayRefundId },
            data: { status: 'PROCESSED', processedAt: new Date() },
          });
        }
        break;
      }

      default:
        logger.info(`[RAZORPAY WEBHOOK] Unhandled event type: ${event}`);
    }

    return { received: true, event };
  }

  /**
   * 5. Order State Machine Transition
   */
  async updateOrderStatus({ orderId, status: newStatus, comment = null, changedByUserId = null, role = 'ADMIN' }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true } },
        items: true,
      },
    });

    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    // Validate state machine transition
    this.validateStatusTransition(order.orderStatus, newStatus);

    const oldStatus = order.orderStatus;

    // Transition in Transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updateData = {
        orderStatus: newStatus,
      };

      if (newStatus === 'CANCELLED') {
        updateData.cancelledAt = new Date();
      }

      const orderUpdated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: oldStatus,
          newStatus,
          comment: comment || `Status updated from ${oldStatus} to ${newStatus}`,
          changedByUserId,
        },
      });

      return orderUpdated;
    });

    // Side Effects & Inventory Restocking
    if (newStatus === 'CANCELLED') {
      // Restore physical stock or release reservation
      if (['CONFIRMED', 'PROCESSING', 'PACKED'].includes(oldStatus)) {
        await inventoryService.restoreOrderStock({
          orderId: order.id,
          reason: comment || 'Order cancelled by administrator/client',
          adminUserId: changedByUserId,
        });
      } else if (oldStatus === 'PENDING') {
        await inventoryService.releaseReservation({
          orderId: order.id,
        });
      }

      // Notify customer of cancellation
      if (order.user && order.user.email) {
        emailService
          .sendOrderCancelledEmail(order.user.email, {
            customerName: order.user.name || 'Valued Clientele',
            order: this.formatOrderForEmail(order),
            reason: comment || 'Order was cancelled.',
            refundStatus: order.paymentStatus === 'CAPTURED' ? 'REFUND_PENDING' : 'N/A',
            userId: order.userId,
          })
          .catch((err) => logger.warn(`[EMAIL] Failed to dispatch cancellation email: ${err.message}`));
      }
    } else if (newStatus === 'DELIVERED') {
      // Mark shipment delivered
      await prisma.shipment.updateMany({
        where: { orderId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });

      if (order.user && order.user.email) {
        emailService
          .sendOrderDeliveredEmail(order.user.email, {
            customerName: order.user.name || 'Valued Clientele',
            order: this.formatOrderForEmail(order),
            userId: order.userId,
          })
          .catch((err) => logger.warn(`[EMAIL] Failed to dispatch delivery email: ${err.message}`));
      }
    }

    logger.info(`[ORDER STATUS] Order ${order.orderNumber} transitioned: ${oldStatus} -> ${newStatus}`);
    return updated;
  }

  /**
   * 6. Order Shipment Creation & Dispatch
   */
  async shipOrder({ orderId, carrier, trackingNumber, trackingUrl = null, estimatedDeliveryAt = null, comment = null, adminUserId }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    // Ensure order is in shippable state
    if (!['CONFIRMED', 'PROCESSING', 'PACKED'].includes(order.orderStatus)) {
      throw ApplicationError.badRequest(
        `Cannot ship order with status ${order.orderStatus}. Order must be CONFIRMED, PROCESSING, or PACKED.`,
        'ORDER_NOT_SHIPPABLE'
      );
    }

    const shipment = await prisma.$transaction(async (tx) => {
      // Upsert shipment record
      const shipRecord = await tx.shipment.create({
        data: {
          orderId,
          carrier,
          trackingNumber,
          trackingUrl,
          estimatedDeliveryAt: estimatedDeliveryAt ? new Date(estimatedDeliveryAt) : null,
          shippedAt: new Date(),
          status: 'IN_TRANSIT',
        },
      });

      // Update order status to SHIPPED
      await tx.order.update({
        where: { id: orderId },
        data: { orderStatus: 'SHIPPED' },
      });

      // Write status history
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: order.orderStatus,
          newStatus: 'SHIPPED',
          comment: comment || `Dispatched with ${carrier} (Tracking: ${trackingNumber})`,
          changedByUserId: adminUserId,
        },
      });

      return shipRecord;
    });

    // Notify Customer of Shipment
    if (order.user && order.user.email) {
      emailService
        .sendOrderShippedEmail(order.user.email, {
          customerName: order.user.name || 'Valued Clientele',
          order: this.formatOrderForEmail(order),
          shipment,
          carrier,
          trackingNumber,
          trackingUrl,
          userId: order.userId,
        })
        .catch((err) => logger.warn(`[EMAIL] Failed to dispatch shipment email: ${err.message}`));
    }

    logger.info(`[ORDER SHIPPED] Order ${order.orderNumber} dispatched via ${carrier} (${trackingNumber})`);
    return shipment;
  }

  /**
   * 7. Customer Order Cancellation
   */
  async cancelOrderByCustomer({ orderId, reason, userId }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (order.userId !== userId) {
      throw ApplicationError.forbidden('You can only cancel your own orders', 'FORBIDDEN_RESOURCE');
    }

    // Only allow cancellation prior to dispatch
    const cancellableStatuses = ['PENDING', 'PLACED', 'CONFIRMED', 'PROCESSING'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      throw ApplicationError.badRequest(
        `This order cannot be cancelled as it is already ${order.orderStatus}. Once packed or shipped, please use the return workflow upon delivery.`,
        'ORDER_NOT_CANCELLABLE'
      );
    }

    return this.updateOrderStatus({
      orderId,
      status: 'CANCELLED',
      comment: `Customer cancellation: ${reason}`,
      changedByUserId: userId,
      role: 'CUSTOMER',
    });
  }

  /**
   * 8. Customer Return Request
   */
  async requestReturn({ orderId, reason, itemIds = [], userId }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, shipments: true },
    });

    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (order.userId !== userId) {
      throw ApplicationError.forbidden('You can only request returns for your own orders', 'FORBIDDEN_RESOURCE');
    }

    if (order.orderStatus !== 'DELIVERED') {
      throw ApplicationError.badRequest('Returns can only be requested for orders that have been DELIVERED.', 'ORDER_NOT_DELIVERED');
    }

    // Validate 14-day luxury return window
    const latestShipment = order.shipments?.find((s) => s.status === 'DELIVERED');
    const deliveryDate = latestShipment?.deliveredAt || order.updatedAt;
    const daysSinceDelivery = (Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDelivery > 14) {
      throw ApplicationError.badRequest(
        'The 14-day return window for this order has expired. For exceptional concierge requests, please contact our atelier.',
        'RETURN_WINDOW_EXPIRED'
      );
    }

    const updated = await this.updateOrderStatus({
      orderId,
      status: 'RETURN_REQUESTED',
      comment: `Customer requested return: ${reason}`,
      changedByUserId: userId,
      role: 'CUSTOMER',
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (user && user.email) {
      emailService
        .sendReturnRequestedEmail(user.email, {
          customerName: user.name || 'Valued Clientele',
          order: this.formatOrderForEmail(order),
          reason,
          userId,
        })
        .catch((err) => logger.warn(`[EMAIL] Failed to dispatch return request email: ${err.message}`));
    }

    return updated;
  }

  /**
   * 9. Admin Return Action (Approve / Reject)
   */
  async adminReturnAction({ orderId, action, reason = null, restockItems = true, adminUserId }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: true },
    });

    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (order.orderStatus !== 'RETURN_REQUESTED') {
      throw ApplicationError.badRequest('Order is not in RETURN_REQUESTED status.', 'INVALID_STATUS');
    }

    if (action === 'APPROVE') {
      const updated = await this.updateOrderStatus({
        orderId,
        status: 'RETURN_APPROVED',
        comment: reason || 'Return request approved by atelier inspection team',
        changedByUserId: adminUserId,
      });

      // If restock items requested, return each line item into inventory
      if (restockItems && order.items && order.items.length > 0) {
        for (const item of order.items) {
          if (item.variantId) {
            await inventoryService.restockReturnedItem({
              orderId,
              variantId: item.variantId,
              quantity: item.quantity,
              reason: 'Accepted customer return back to atelier stock',
              adminUserId,
            });
          }
        }
      }

      if (order.user && order.user.email) {
        emailService
          .sendReturnApprovedEmail(order.user.email, {
            customerName: order.user.name || 'Valued Clientele',
            order: this.formatOrderForEmail(order),
            pickupDetails: 'Our complimentary courier will pick up the sealed return package within 48 hours.',
            userId: order.userId,
          })
          .catch((err) => logger.warn(`[EMAIL] Failed to dispatch return approval email: ${err.message}`));
      }

      return updated;
    } else {
      // Reject return: transition back to DELIVERED
      return this.updateOrderStatus({
        orderId,
        status: 'DELIVERED',
        comment: `Return rejected by admin: ${reason || 'Return conditions not satisfied'}`,
        changedByUserId: adminUserId,
      });
    }
  }

  /**
   * 10. Process Online Refund via Razorpay API
   */
  async processRefund({ orderId, amount = null, reason = 'Customer refund processed', adminUserId }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: { where: { status: { in: ['CAPTURED', 'PARTIALLY_REFUNDED'] } } },
        refunds: true,
        user: true,
      },
    });

    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (order.paymentStatus !== 'CAPTURED' && order.paymentStatus !== 'PARTIALLY_REFUNDED') {
      throw ApplicationError.badRequest('Cannot process refund for an order that is not marked CAPTURED or PARTIALLY_REFUNDED.', 'ORDER_NOT_PAID');
    }

    const primaryPayment = order.payments[0];
    if (!primaryPayment) {
      throw ApplicationError.badRequest('No captured payment found on record for this order.', 'NO_PAYMENT_FOUND');
    }

    const totalCaptured = Number(primaryPayment.amount);
    const alreadyRefunded = (order.refunds || [])
      .filter((r) => r.status === 'PROCESSED' || r.status === 'COMPLETED')
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const maxRefundable = Math.max(0, totalCaptured - alreadyRefunded);

    const refundAmount = amount ? Number(amount) : maxRefundable;

    if (refundAmount <= 0) {
      throw ApplicationError.badRequest('Refund amount must be greater than zero.', 'INVALID_REFUND_AMOUNT');
    }

    if (refundAmount > maxRefundable) {
      throw ApplicationError.badRequest(
        `Requested refund amount of ₹${refundAmount.toLocaleString('en-IN')} exceeds remaining refundable balance of ₹${maxRefundable.toLocaleString('en-IN')}.`,
        'REFUND_EXCEEDS_BALANCE'
      );
    }

    const isFullRefund = (alreadyRefunded + refundAmount) >= totalCaptured;
    const nextPaymentStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    // Call Razorpay Refund or Mock
    const razorpayRefund = await razorpayUtil.processRefund({
      paymentId: primaryPayment.razorpayPaymentId,
      amount: refundAmount,
      notes: { orderId, reason },
    });

    // Record Refund in Database
    const refund = await prisma.$transaction(async (tx) => {
      const rec = await tx.refund.create({
        data: {
          orderId,
          paymentId: primaryPayment.id,
          razorpayRefundId: razorpayRefund.id,
          amount: refundAmount,
          currency: 'INR',
          status: 'PROCESSED',
          reason,
          adminUserId,
          processedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: nextPaymentStatus },
      });

      await tx.payment.update({
        where: { id: primaryPayment.id },
        data: { status: nextPaymentStatus },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: order.orderStatus,
          newStatus: order.orderStatus,
          comment: `Refund processed: ₹${refundAmount.toLocaleString('en-IN')} (Razorpay Refund ID: ${razorpayRefund.id})`,
          changedByUserId: adminUserId,
        },
      });

      return rec;
    });

    // Dispatch Refund Email
    if (order.user && order.user.email) {
      emailService
        .sendRefundProcessedEmail(order.user.email, {
          customerName: order.user.name || 'Valued Clientele',
          order: this.formatOrderForEmail(order),
          refund,
          amount: `₹${refundAmount.toLocaleString('en-IN')}`,
          refundId: razorpayRefund.id,
          userId: order.userId,
        })
        .catch((err) => logger.warn(`[EMAIL] Failed to dispatch refund processed email: ${err.message}`));
    }

    logger.info(`[REFUND PROCESSED] Order ${order.orderNumber} refunded ₹${refundAmount} (Refund ID: ${razorpayRefund.id})`);
    return refund;
  }

  /**
   * 11. Add Internal Admin Notes
   */
  async addAdminNote({ orderId, notes, adminUserId }) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: orderId },
        data: { adminNotes: notes },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: order.orderStatus,
          newStatus: order.orderStatus,
          comment: `[Atelier Internal Note] ${notes}`,
          changedByUserId: adminUserId,
        },
      });

      return ord;
    });

    return updated;
  }

  /**
   * 12. Retrieve Full Order Details
   */
  async getOrderDetails({ orderId, userId = null, role = 'CUSTOMER' }) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const whereClause = isUuid ? { id: orderId } : { orderNumber: orderId };

    const order = await prisma.order.findUnique({
      where: whereClause,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            variant: { select: { id: true, sku: true, size: true, colorName: true } },
          },
        },
        addressSnapshot: true,
        payments: { orderBy: { createdAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        shipments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!order) {
      throw ApplicationError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (role !== 'ADMIN' && userId && order.userId !== userId) {
      throw ApplicationError.forbidden('You do not have permission to view this order', 'FORBIDDEN_RESOURCE');
    }

    const enrichedItems = (order.items || []).map((it) => {
      const unitSelling = Number(it.unitSellingPrice || 0);
      const lineFinal = Number(it.finalItemAmount || 0);
      const mrp = Number(it.compareAtPrice || unitSelling);
      const lineTax = Number(it.tax || 0);
      const lineDiscount = Number(it.applicableDiscount || 0);

      return {
        ...it,
        unitSellingPrice: unitSelling,
        unitPrice: unitSelling,
        price: unitSelling,
        compareAtPrice: mrp,
        mrp,
        finalItemAmount: lineFinal,
        totalPrice: lineFinal,
        lineTotal: lineFinal,
        tax: lineTax,
        taxAmount: lineTax,
        applicableDiscount: lineDiscount,
        discountAmount: lineDiscount,
        discount: lineDiscount,
        sizeName: it.selectedSize || it.variant?.size || it.variantDetails?.size || 'Standard',
        colorName: it.selectedColor || it.variant?.colorName || it.variantDetails?.colorName || 'Default',
      };
    });

    const grandTotal = Number(order.grandTotal || 0);
    const itemSubtotal = Number(order.itemSubtotal || 0);
    const mrpSubtotal = Number(order.mrpSubtotal || itemSubtotal);
    const offerDiscount = Number(order.offerDiscount || 0);
    const flashSaleDiscount = Number(order.flashSaleDiscount || 0);
    const couponDiscount = Number(order.couponDiscount || 0);
    const totalPromotionalDiscount = offerDiscount + flashSaleDiscount;
    const totalDiscount = totalPromotionalDiscount + couponDiscount;
    const tax = Number(order.tax || 0);
    const shipping = Number(order.shipping || 0);

    return {
      ...order,
      grandTotal,
      totalAmount: grandTotal,
      totalPayable: grandTotal,
      payableAmount: grandTotal,
      total: grandTotal,
      itemSubtotal,
      subtotal: itemSubtotal,
      mrpSubtotal,
      offerDiscount,
      flashSaleDiscount,
      couponDiscount,
      discountAmount: totalPromotionalDiscount,
      totalDiscount,
      tax,
      taxAmount: tax,
      shipping,
      shippingFee: shipping,
      shippingAmount: shipping,
      items: enrichedItems,
    };
  }

  /**
   * 13. Customer Order History with Pagination
   */
  async getCustomerOrders({ userId, page = 1, limit = 10, orderStatus = null }) {
    const skip = (page - 1) * limit;
    const where = {
      userId,
      ...(orderStatus ? { orderStatus } : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { placedAt: 'desc' },
        include: {
          items: {
            take: 6,
            select: {
              id: true,
              productName: true,
              productImage: true,
              selectedSize: true,
              selectedColor: true,
              quantity: true,
              unitSellingPrice: true,
              finalItemAmount: true,
            },
          },
          shipments: {
            take: 1,
            select: {
              carrier: true,
              trackingNumber: true,
              status: true,
              estimatedDeliveryAt: true,
            },
          },
        },
      }),
    ]);

    const enrichedOrders = orders.map((o) => ({
      ...o,
      totalAmount: Number(o.grandTotal || 0),
      totalPayable: Number(o.grandTotal || 0),
      subtotal: Number(o.itemSubtotal || 0),
      taxAmount: Number(o.tax || 0),
      shippingFee: Number(o.shipping || 0),
      discountAmount: Number(o.offerDiscount || 0) + Number(o.flashSaleDiscount || 0),
      items: (o.items || []).map((it) => ({
        ...it,
        unitPrice: Number(it.unitSellingPrice || 0),
        totalPrice: Number(it.finalItemAmount ?? (Number(it.unitSellingPrice || 0) * (it.quantity || 1))),
      })),
    }));

    return {
      orders: enrichedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 14. Admin Order Listing with Multi-faceted Filtering & Search
   */
  async listAdminOrders({
    page = 1,
    limit = 20,
    orderStatus = null,
    paymentStatus = null,
    paymentMethod = null,
    search = null,
    startDate = null,
    endDate = null,
    sortBy = 'placedAt',
    sortOrder = 'desc',
  }) {
    const skip = (page - 1) * limit;
    const where = {};

    if (orderStatus) where.orderStatus = orderStatus;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      where.placedAt = {};
      if (startDate) where.placedAt.gte = new Date(startDate);
      if (endDate) where.placedAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: {
            select: {
              id: true,
              productName: true,
              sku: true,
              quantity: true,
              finalItemAmount: true,
            },
          },
          payments: {
            take: 1,
            select: {
              id: true,
              method: true,
              status: true,
              razorpayPaymentId: true,
            },
          },
          shipments: {
            take: 1,
            select: {
              carrier: true,
              trackingNumber: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const enrichedOrders = orders.map((o) => ({
      ...o,
      grandTotal: Number(o.grandTotal || 0),
      totalAmount: Number(o.grandTotal || 0),
      totalPayable: Number(o.grandTotal || 0),
      payableAmount: Number(o.grandTotal || 0),
      itemSubtotal: Number(o.itemSubtotal || 0),
      subtotal: Number(o.itemSubtotal || 0),
      tax: Number(o.tax || 0),
      taxAmount: Number(o.tax || 0),
      shipping: Number(o.shipping || 0),
      shippingFee: Number(o.shipping || 0),
      discountAmount: Number(o.offerDiscount || 0) + Number(o.flashSaleDiscount || 0),
      items: (o.items || []).map((it) => ({
        ...it,
        unitPrice: Number(it.finalItemAmount ? it.finalItemAmount / (it.quantity || 1) : 0),
        totalPrice: Number(it.finalItemAmount || 0),
      })),
    }));

    return {
      orders: enrichedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 15. Track Order Pipeline
   */
  async getOrderTracking({ orderId, userId = null, role = 'CUSTOMER' }) {
    const order = await this.getOrderDetails({ orderId, userId, role });

    const primaryShipment = order.shipments?.[0] || null;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      placedAt: order.placedAt,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddressSnapshot,
      shipment: primaryShipment
        ? {
            carrier: primaryShipment.carrier,
            trackingNumber: primaryShipment.trackingNumber,
            trackingUrl: primaryShipment.trackingUrl,
            status: primaryShipment.status,
            shippedAt: primaryShipment.shippedAt,
            estimatedDeliveryAt: primaryShipment.estimatedDeliveryAt,
            deliveredAt: primaryShipment.deliveredAt,
          }
        : null,
      timeline: (order.statusHistory || []).map((h) => ({
        status: h.newStatus,
        comment: h.comment,
        timestamp: h.createdAt,
      })),
    };
  }

  /**
   * 16. Invoice Generation (Data & HTML)
   */
  async getInvoiceData({ orderId, userId = null, role = 'CUSTOMER' }) {
    const order = await this.getOrderDetails({ orderId, userId, role });
    return generateInvoiceData(order);
  }

  async getInvoiceHtml({ orderId, userId = null, role = 'CUSTOMER' }) {
    const order = await this.getOrderDetails({ orderId, userId, role });
    return generateInvoiceHtml(order);
  }
}

export const orderService = new OrderService();
export default orderService;
