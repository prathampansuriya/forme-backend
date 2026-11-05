import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/prisma.config.js';
import emailService from '../src/services/email.service.js';
import { getEmailProvider, getSpecificProvider } from '../src/services/email/emailProviderFactory.js';
import { BaseEmailProvider } from '../src/services/email/BaseEmailProvider.js';
import { NodemailerProvider } from '../src/services/email/NodemailerProvider.js';
import { BrevoProvider } from '../src/services/email/BrevoProvider.js';
import emailQueue from '../src/services/email/emailQueue.js';
import * as templates from '../src/templates/index.js';

describe('FORME Email Infrastructure & Notification Automation Suite', { timeout: 25000 }, () => {
  const testRecipient = `atelier.client.${Date.now()}@forme.store`;
  const sampleOrderId = `ord_test_${Date.now()}`;

  afterAll(async () => {
    // Clean up test email delivery logs
    await prisma.emailDeliveryLog.deleteMany({
      where: { recipientEmail: testRecipient },
    });
    await prisma.$disconnect();
  });

  // 1. Provider Abstraction Tests
  describe('1. Provider Abstraction Architecture', () => {
    it('should prevent direct instantiation of BaseEmailProvider', () => {
      expect(() => new BaseEmailProvider('TEST')).toThrow(TypeError);
    });

    it('should instantiate NodemailerProvider and inherit BaseEmailProvider', () => {
      const provider = new NodemailerProvider();
      expect(provider).toBeInstanceOf(BaseEmailProvider);
      expect(provider.name).toBe('NODEMAILER');
    });

    it('should instantiate BrevoProvider and inherit BaseEmailProvider', () => {
      const provider = new BrevoProvider();
      expect(provider).toBeInstanceOf(BaseEmailProvider);
      expect(provider.name).toBe('BREVO');
    });

    it('should resolve provider dynamically via EmailProviderFactory', () => {
      const defaultProvider = getEmailProvider();
      expect(defaultProvider).toBeDefined();
      expect(typeof defaultProvider.send).toBe('function');

      const brevo = getSpecificProvider('brevo');
      expect(brevo.name).toBe('BREVO');

      const nodemailer = getSpecificProvider('nodemailer');
      expect(nodemailer.name).toBe('NODEMAILER');
    });
  });

  // 2. Email Template Rendering Tests (Authentication, Commerce, Marketing, Admin)
  describe('2. Email Template Rendering (28 Types)', () => {
    it('should render all 7 Authentication templates correctly with brand elements', () => {
      const otp = '987654';
      const reg = templates.registrationOtpTemplate({ name: 'Éléonore', otp });
      expect(reg.subject).toContain('Verify Your FORME Identity');
      expect(reg.html).toContain(otp);
      expect(reg.html).toContain('FORME');
      expect(reg.html).toContain('concierge@forme.store');

      const resend = templates.resendOtpTemplate({ name: 'Éléonore', otp });
      expect(resend.subject).toContain('Fresh Verification Passcode');

      const welcome = templates.welcomeTemplate({ name: 'Éléonore' });
      expect(welcome.subject).toContain('Welcome to FORME');

      const forgot = templates.forgotPasswordTemplate({ name: 'Éléonore', resetUrl: 'https://forme.store/reset?token=xyz' });
      expect(forgot.html).toContain('https://forme.store/reset?token=xyz');

      const resetConf = templates.passwordResetConfirmationTemplate({ name: 'Éléonore' });
      expect(resetConf.subject).toContain('Password Successfully Updated');

      const pwdAlert = templates.passwordChangedAlertTemplate({ name: 'Éléonore', ipAddress: '192.168.1.1' });
      expect(pwdAlert.html).toContain('192.168.1.1');

      const loginAlert = templates.newLoginAlertTemplate({ name: 'Éléonore', ipAddress: '10.0.0.1' });
      expect(loginAlert.html).toContain('10.0.0.1');
    });

    it('should render Commerce templates with financial math and item tables', () => {
      const mockOrder = {
        id: sampleOrderId,
        orderNumber: 'FRM-2026-999',
        totalAmount: 48500,
        subtotal: 45000,
        taxAmount: 3500,
        shippingCost: 0,
        discountAmount: 0,
        paymentMethod: 'Razorpay UPI',
      };
      const mockItems = [
        {
          title: 'Structured Wool Trench Coat',
          variantName: 'Obsidian / EU 40',
          quantity: 1,
          unitPrice: 45000,
          price: 45000,
          imageUrl: 'https://forme.store/trench.jpg',
        },
      ];
      const mockAddr = {
        fullName: 'Baroness Camille',
        addressLine1: 'Boulevard Saint-Germain 14',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
      };

      const placed = templates.orderPlacedTemplate({
        customerName: 'Baroness Camille',
        order: mockOrder,
        orderItems: mockItems,
        shippingAddress: mockAddr,
      });
      expect(placed.subject).toContain('FRM-2026-999');
      expect(placed.html).toContain('Structured Wool Trench Coat');
      expect(placed.html).toContain('Grand Total');

      const shipped = templates.orderShippedTemplate({
        customerName: 'Baroness Camille',
        order: mockOrder,
        courierName: 'Bluedart Express',
        shipment: { trackingNumber: 'BD987654321IN' },
      });
      expect(shipped.html).toContain('BD987654321IN');
      expect(shipped.html).toContain('Bluedart Express');

      const delivered = templates.orderDeliveredTemplate({
        customerName: 'Baroness Camille',
        order: mockOrder,
      });
      expect(delivered.subject).toContain('Delivered');

      const refund = templates.refundCompletedTemplate({
        customerName: 'Baroness Camille',
        order: mockOrder,
        refundAmount: 48500,
        refundId: 'rfnd_001',
      });
      expect(refund.subject).toContain('Refund Completed');
    });

    it('should render Marketing templates with compliant 1-click unsubscribe links', () => {
      const promo = templates.promotionalCampaignTemplate({
        customerName: 'Patron',
        campaignTitle: 'L’Automne / L’Hiver 2026 Capsule',
        description: 'An architectural exploration of heavyweight double-faced cashmere.',
        unsubscribeUrl: 'https://forme.store/unsubscribe?token=sample',
      });
      expect(promo.html).toContain('Unsubscribe from promotional dispatches');
      expect(promo.html).toContain('https://forme.store/unsubscribe?token=sample');

      const voucher = templates.couponOfferTemplate({
        customerName: 'Patron',
        couponCode: 'HAUTE15',
        discountText: '15% Off Your Next Piece',
        expiryDate: 'November 30, 2026',
      });
      expect(voucher.html).toContain('HAUTE15');
    });

    it('should render Admin alerts with confidential operational headers', () => {
      const adminOrder = templates.adminNewOrderAlertTemplate({
        order: { id: sampleOrderId, orderNumber: 'FRM-2026-999', paymentMethod: 'Razorpay' },
        customerName: 'Baroness Camille',
        totalAmount: 48500,
      });
      expect(adminOrder.subject).toContain('[ADMIN ALERT]');
      expect(adminOrder.html).toContain('FORME Internal Operational Dispatch');

      const lowStock = templates.adminLowStockAlertTemplate({
        productTitle: 'Cashmere Draped Overcoat',
        sku: 'CDO-BLK-M',
        currentStock: 2,
        threshold: 5,
      });
      expect(lowStock.subject).toContain('[INVENTORY ALERT]');
      expect(lowStock.html).toContain('CDO-BLK-M');
    });
  });

  // 3. Dispatch & Delivery Logging Tests
  describe('3. Dispatch, Idempotency & Audit Logging', () => {
    it('should dispatch an email and write audit log to PostgreSQL', async () => {
      const result = await emailService.sendRegistrationOTP(testRecipient, {
        name: 'Éléonore de Valois',
        otp: '654321',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.status).toBe('SENT');

      // Verify PostgreSQL EmailDeliveryLog record
      const log = await prisma.emailDeliveryLog.findFirst({
        where: { recipientEmail: testRecipient, templateName: 'registration-otp' },
        orderBy: { sentAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log.recipientEmail).toBe(testRecipient);
      expect(log.provider).toBeDefined();
      expect(log.status).toBe('SENT');
      expect(log.attempts).toBeGreaterThanOrEqual(1);

      // Verify security rule: OTP plaintext must NOT be saved in log
      expect(log.subject).not.toContain('654321');
      if (log.errorDetails) {
        expect(log.errorDetails).not.toContain('654321');
      }
    });

    it('should respect idempotency key and prevent duplicate email dispatch', async () => {
      const uniqueKey = `idemp-test-${Date.now()}`;

      // First dispatch
      const firstResult = await emailService.sendMail({
        to: testRecipient,
        subject: 'First Exclusive Dispatch',
        html: '<p>First dispatch</p>',
        templateName: 'custom',
        idempotencyKey: uniqueKey,
      });
      expect(firstResult.success).toBe(true);
      expect(firstResult.skipped).toBeUndefined();

      // Duplicate dispatch with same key
      const duplicateResult = await emailService.sendMail({
        to: testRecipient,
        subject: 'Second Duplicate Dispatch',
        html: '<p>Duplicate dispatch</p>',
        templateName: 'custom',
        idempotencyKey: uniqueKey,
      });

      expect(duplicateResult.success).toBe(true);
      expect(duplicateResult.skipped).toBe(true);
      expect(duplicateResult.messageId).toBe(firstResult.messageId);

      // Verify database has exactly 1 entry with this idempotency key
      const count = await prisma.emailDeliveryLog.count({
        where: { idempotencyKey: uniqueKey },
      });
      expect(count).toBe(1);
    });

    it('should record Commerce and Admin dispatches with orderId references', async () => {
      const orderRes = await emailService.sendOrderConfirmationEmail(testRecipient, {
        customerName: 'Éléonore',
        order: { id: sampleOrderId, orderNumber: 'FRM-ORD-777', totalAmount: 22000 },
        orderItems: [],
        shippingAddress: { fullName: 'Éléonore', city: 'Mumbai' },
      });

      expect(orderRes.success).toBe(true);

      const commerceLog = await prisma.emailDeliveryLog.findFirst({
        where: { orderId: sampleOrderId, templateName: 'order-confirmation' },
      });
      expect(commerceLog).toBeDefined();
      expect(commerceLog.orderId).toBe(sampleOrderId);
    });

    it('should verify provider connections via health probe', async () => {
      const status = await emailService.verifyProviders();
      expect(status.activeProvider).toBeDefined();
      expect(status.providers.nodemailer).toBeDefined();
      expect(status.providers.brevo).toBeDefined();
    });
  });

  // 4. In-Process Queue & Reliability Tests
  describe('4. In-Process Reliability & Retry Engine', () => {
    it('should execute tasks with retry on transient failures and track attempts', async () => {
      let callCount = 0;
      const result = await emailQueue.executeWithRetry(
        async (attempt) => {
          callCount++;
          if (attempt < 2) {
            throw new Error('Temporary SMTP socket timeout');
          }
          return { success: true, attempts: attempt };
        },
        { maxRetries: 3, initialDelayMs: 50, backoffFactor: 1.5 }
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(callCount).toBe(2);
    });

    it('should throttle and process concurrent queue items in sequence', async () => {
      const completed = [];
      await Promise.all([
        emailQueue.enqueue(async () => {
          completed.push(1);
          return 1;
        }),
        emailQueue.enqueue(async () => {
          completed.push(2);
          return 2;
        }),
      ]);

      expect(completed).toEqual([1, 2]);
    });
  });
});

