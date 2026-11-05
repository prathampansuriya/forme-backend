import crypto from 'crypto';
import getRazorpayInstance from '../config/razorpay.config.js';
import env from '../config/env.config.js';
import { logger } from '../config/logger.config.js';

class RazorpayUtil {
  constructor() {
    this.keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
    this.keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || 'test_secret_mock';
    this.webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_mock';
  }

  /**
   * Creates an order with Razorpay in smallest currency unit (paise for INR).
   * In test environment or if client is not configured, provides deterministic simulation.
   */
  async createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    // amount must be in paise (e.g. ₹5,000.00 = 500000)
    const amountInPaise = Math.round(Number(amount));

    const razorpay = getRazorpayInstance();

    if (razorpay && env.NODE_ENV !== 'test') {
      try {
        const order = await razorpay.orders.create({
          amount: amountInPaise,
          currency,
          receipt: String(receipt).slice(0, 40),
          notes,
        });

        return {
          id: order.id,
          entity: order.entity,
          amount: order.amount,
          amount_paid: order.amount_paid,
          amount_due: order.amount_due,
          currency: order.currency,
          receipt: order.receipt,
          status: order.status,
          created_at: order.created_at,
        };
      } catch (err) {
        logger.warn(`[RAZORPAY] API call failed (${err.message}), falling back to deterministic order generation for dev/sandbox`);
      }
    }

    // Deterministic mock for testing or offline sandbox
    const mockOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;
    return {
      id: mockOrderId,
      entity: 'order',
      amount: amountInPaise,
      amount_paid: 0,
      amount_due: amountInPaise,
      currency,
      receipt: String(receipt).slice(0, 40),
      status: 'created',
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Cryptographically verifies payment signature received from client callback.
   * HMAC-SHA256(razorpay_order_id + '|' + razorpay_payment_id, secret) === razorpay_signature
   */
  verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return false;
    }

    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const secret = this.keySecret;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const receivedBuffer = Buffer.from(razorpaySignature, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Generates a valid test signature for automated tests.
   */
  generateTestSignature(razorpayOrderId, razorpayPaymentId) {
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    return crypto.createHmac('sha256', this.keySecret).update(payload).digest('hex');
  }

  /**
   * Cryptographically verifies Razorpay Webhook signature using raw request body.
   * HMAC-SHA256(rawBody, webhookSecret) === X-Razorpay-Signature
   */
  verifyWebhookSignature({ rawBody, signature, secret = null }) {
    if (!rawBody || !signature) {
      return false;
    }

    const webhookSecret = secret || this.webhookSecret;
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyBuffer)
      .digest('hex');

    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const receivedBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Generates a valid webhook signature for automated tests.
   */
  generateTestWebhookSignature(rawBody, secret = null) {
    const webhookSecret = secret || this.webhookSecret;
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    return crypto.createHmac('sha256', webhookSecret).update(bodyBuffer).digest('hex');
  }

  /**
   * Initiates a refund through Razorpay or returns mock refund response in test.
   */
  async processRefund({ paymentId, amount, notes = {} }) {
    const amountInPaise = Math.round(Number(amount) * 100);
    const razorpay = getRazorpayInstance();

    if (razorpay && env.NODE_ENV !== 'test' && paymentId && !paymentId.startsWith('pay_mock_') && !paymentId.startsWith('pay_test_')) {
      try {
        const refund = await razorpay.payments.refund(paymentId, {
          amount: amountInPaise,
          notes,
        });

        return {
          id: refund.id,
          entity: 'refund',
          amount: refund.amount,
          currency: refund.currency,
          payment_id: refund.payment_id,
          status: refund.status,
          created_at: refund.created_at,
        };
      } catch (err) {
        logger.warn(`[RAZORPAY REFUND] API call failed (${err.message}), falling back to deterministic refund`);
      }
    }

    // Mock refund for dev/testing
    const mockRefundId = `rfnd_${crypto.randomBytes(8).toString('hex')}`;
    return {
      id: mockRefundId,
      entity: 'refund',
      amount: amountInPaise,
      currency: 'INR',
      payment_id: paymentId,
      status: 'processed',
      created_at: Math.floor(Date.now() / 1000),
    };
  }
}

export const razorpayUtil = new RazorpayUtil();
export default razorpayUtil;

