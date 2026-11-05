import prisma from '../config/prisma.config.js';
import env from '../config/env.config.js';
import { getEmailProvider, getSpecificProvider } from './email/emailProviderFactory.js';
import emailQueue from './email/emailQueue.js';
import * as templates from '../templates/index.js';

// Mask email for privacy in logs: "c***@forme.store"
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return 'unknown';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
};

class EmailService {
  /**
   * Core dispatcher that handles:
   * - Provider abstraction (Nodemailer / Brevo)
   * - Idempotency checking (prevents duplicate dispatch)
   * - Exponential backoff retries (transient failure tolerance)
   * - Safe PostgreSQL audit logging (never persists OTPs or credentials)
   * - Masked structured logging
   */
  async sendMail({
    to,
    subject,
    html,
    text,
    templateName = 'custom',
    idempotencyKey = null,
    userId = null,
    orderId = null,
    metadata = null,
    providerOverride = null,
    attachments = [],
    tags = [],
  }) {
    const recipient = Array.isArray(to) ? to[0] : to;
    const cleanEmail = (typeof recipient === 'string' ? recipient : recipient.email).toLowerCase().trim();

    // 1. Idempotency Check: Avoid duplicate delivery of the same business event
    if (idempotencyKey) {
      try {
        const existingLog = await prisma.emailDeliveryLog.findUnique({
          where: { idempotencyKey },
        });

        if (existingLog && ['SENT', 'DELIVERED'].includes(existingLog.status)) {
          console.log(
            `[FORME EMAIL] Idempotent skip: email with key "${idempotencyKey}" was already dispatched to ${maskEmail(cleanEmail)} (MessageID: ${existingLog.messageId})`
          );
          return {
            success: true,
            messageId: existingLog.messageId,
            status: existingLog.status,
            skipped: true,
            provider: existingLog.provider,
          };
        }
      } catch (err) {
        console.warn(`[FORME EMAIL] Idempotency lookup failed: ${err.message}`);
      }
    }

    // 2. Select Provider via Factory
    const provider = getEmailProvider(providerOverride);
    let attemptsCount = 0;
    let messageId = null;
    let status = 'SENT';
    let errorDetails = null;

    // 3. Execute with Retry Policy
    try {
      const result = await emailQueue.executeWithRetry(
        async (attempt) => {
          attemptsCount = attempt;
          return await provider.send({
            to: cleanEmail,
            subject,
            html,
            text,
            attachments,
            tags: [templateName, ...tags],
          });
        },
        { maxRetries: 3, initialDelayMs: 400, backoffFactor: 2 }
      );

      messageId = result.messageId;

      if (env.NODE_ENV !== 'test') {
        console.log(
          `✉️  [FORME EMAIL] Sent "${templateName}" to ${maskEmail(cleanEmail)} via ${provider.name} (Attempt ${attemptsCount}, ID: ${messageId})`
        );
      }
    } catch (err) {
      status = 'FAILED';
      errorDetails = err.message || 'Unknown transport dispatch failure';
      console.error(
        `❌ [FORME EMAIL ERROR] Failed to send "${templateName}" to ${maskEmail(cleanEmail)} via ${provider.name}:`,
        errorDetails
      );
    }

    // 4. Persist Delivery Audit Log to PostgreSQL
    // Sanitize metadata: Never log passwords, tokens, or OTP codes
    const sanitizedMetadata = metadata ? { ...metadata } : {};
    delete sanitizedMetadata.password;
    delete sanitizedMetadata.otp;
    delete sanitizedMetadata.token;

    try {
      await prisma.emailDeliveryLog.create({
        data: {
          recipientEmail: cleanEmail,
          subject,
          templateName,
          provider: provider.name,
          messageId,
          status,
          attempts: Math.max(attemptsCount, 1),
          userId,
          orderId,
          metadata: Object.keys(sanitizedMetadata).length > 0 ? sanitizedMetadata : undefined,
          idempotencyKey: idempotencyKey || undefined,
          errorDetails: errorDetails ? errorDetails.substring(0, 1000) : null,
        },
      });
    } catch (logErr) {
      console.error('[FORME EMAIL] Failed to record email delivery audit log:', logErr.message);
    }

    return {
      success: status === 'SENT',
      messageId,
      status,
      attempts: attemptsCount,
      provider: provider.name,
      error: errorDetails,
    };
  }

  // ==========================================
  // AUTHENTICATION EMAILS (7 TYPES)
  // ==========================================

  /**
   * 1. Registration OTP
   */
  async sendRegistrationOTP(to, { name = 'Valued Clientele', otp, userId = null }) {
    const { subject, html, text } = templates.registrationOtpTemplate({ name, otp });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'registration-otp',
      userId,
      idempotencyKey: userId ? `reg-otp-${userId}-${Date.now()}` : null,
    });
  }

  /**
   * 2. Resend OTP
   */
  async sendResendOTP(to, { name = 'Valued Clientele', otp, userId = null }) {
    const { subject, html, text } = templates.resendOtpTemplate({ name, otp });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'resend-otp',
      userId,
    });
  }

  /**
   * 3. Welcome Email
   */
  async sendWelcomeEmail(to, { name = 'Valued Clientele', userId = null } = {}) {
    // Also supports legacy signature: sendWelcomeEmail(to, name)
    const clientName = typeof arguments[1] === 'string' ? arguments[1] : name;
    const { subject, html, text } = templates.welcomeTemplate({ name: clientName });

    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'welcome-email',
      userId,
      idempotencyKey: userId ? `welcome-${userId}` : `welcome-${to}`,
    });
  }

  /**
   * 4. Forgot Password
   */
  async sendForgotPasswordEmail(to, { name = 'Valued Clientele', resetUrl, userId = null } = {}) {
    const clientName = typeof arguments[1] === 'string' ? arguments[1] : name;
    const url = typeof arguments[2] === 'string' ? arguments[2] : resetUrl;

    const { subject, html, text } = templates.forgotPasswordTemplate({ name: clientName, resetUrl: url });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'forgot-password',
      userId,
    });
  }

  /**
   * 5. Password Reset Confirmation
   */
  async sendPasswordResetConfirmation(to, { name = 'Valued Clientele', userId = null } = {}) {
    const { subject, html, text } = templates.passwordResetConfirmationTemplate({ name });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'password-reset-confirmed',
      userId,
    });
  }

  /**
   * 6. Password Changed Security Alert
   */
  async sendPasswordChangedAlert(to, { name = 'Valued Clientele', ipAddress, deviceInfo, userId = null } = {}) {
    const { subject, html, text } = templates.passwordChangedAlertTemplate({ name, ipAddress, deviceInfo });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'password-changed-alert',
      userId,
    });
  }

  /**
   * 7. New Login / Security Notification
   */
  async sendNewLoginAlert(to, { name = 'Valued Clientele', ipAddress, deviceInfo, loginTime, userId = null } = {}) {
    const { subject, html, text } = templates.newLoginAlertTemplate({ name, ipAddress, deviceInfo, loginTime });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'new-login-alert',
      userId,
    });
  }

  // ==========================================
  // COMMERCE EMAILS (13 TYPES)
  // ==========================================

  /**
   * 8. Order Placed
   */
  async sendOrderPlacedEmail(to, { customerName, order, orderItems, shippingAddress, userId = null }) {
    const { subject, html, text } = templates.orderPlacedTemplate({ customerName, order, orderItems, shippingAddress });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'order-placed',
      orderId: order.id,
      userId,
      idempotencyKey: `order-placed-${order.id}`,
    });
  }

  /**
   * 9. Order Confirmation
   */
  async sendOrderConfirmationEmail(to, { customerName, order, orderItems, shippingAddress, userId = null }) {
    const { subject, html, text } = templates.orderConfirmationTemplate({ customerName, order, orderItems, shippingAddress });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'order-confirmation',
      orderId: order.id,
      userId,
      idempotencyKey: `order-confirmed-${order.id}`,
    });
  }

  /**
   * 10. Payment Successful
   */
  async sendPaymentSuccessfulEmail(to, { customerName, order, payment, userId = null }) {
    const { subject, html, text } = templates.paymentSuccessfulTemplate({ customerName, order, payment });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'payment-successful',
      orderId: order.id,
      userId,
      idempotencyKey: `payment-success-${payment.id || order.id}`,
    });
  }

  /**
   * 11. Payment Failed
   */
  async sendPaymentFailedEmail(to, { customerName, order, payment, retryUrl, userId = null }) {
    const { subject, html, text } = templates.paymentFailedTemplate({ customerName, order, payment, retryUrl });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'payment-failed',
      orderId: order.id,
      userId,
    });
  }

  /**
   * 12. COD Order Confirmation
   */
  async sendCodOrderConfirmationEmail(to, { customerName, order, confirmationUrl, userId = null }) {
    const { subject, html, text } = templates.codOrderConfirmationTemplate({ customerName, order, confirmationUrl });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'cod-order-confirmation',
      orderId: order.id,
      userId,
      idempotencyKey: `cod-confirm-${order.id}`,
    });
  }

  /**
   * 13. Order Processing
   */
  async sendOrderProcessingEmail(to, { customerName, order, userId = null }) {
    const { subject, html, text } = templates.orderProcessingTemplate({ customerName, order });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'order-processing',
      orderId: order.id,
      userId,
      idempotencyKey: `order-processing-${order.id}`,
    });
  }

  /**
   * 14. Order Packed
   */
  async sendOrderPackedEmail(to, { customerName, order, packageDetails, userId = null }) {
    const { subject, html, text } = templates.orderPackedTemplate({ customerName, order, packageDetails });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'order-packed',
      orderId: order.id,
      userId,
      idempotencyKey: `order-packed-${order.id}`,
    });
  }

  /**
   * 15. Order Shipped
   */
  async sendOrderShippedEmail(to, { customerName, order, shipment, trackingUrl, courierName, userId = null }) {
    const { subject, html, text } = templates.orderShippedTemplate({
      customerName,
      order,
      shipment,
      trackingUrl,
      courierName,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'order-shipped',
      orderId: order.id,
      userId,
      idempotencyKey: `order-shipped-${order.id}-${shipment?.id || 'standard'}`,
    });
  }

  /**
   * 16. Order Out for Delivery
   */
  async sendOrderOutForDeliveryEmail(to, { customerName, order, deliveryAgentName, deliveryDate, userId = null }) {
    const { subject, html, text } = templates.orderOutForDeliveryTemplate({
      customerName,
      order,
      deliveryAgentName,
      deliveryDate,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'order-out-for-delivery',
      orderId: order.id,
      userId,
      idempotencyKey: `order-out-for-delivery-${order.id}`,
    });
  }

  /**
   * 17. Order Delivered
   */
  async sendOrderDeliveredEmail(to, { customerName, order, deliveryDate, reviewUrl, userId = null }) {
    const { subject, html, text } = templates.orderDeliveredTemplate({
      customerName,
      order,
      deliveryDate,
      reviewUrl,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'order-delivered',
      orderId: order.id,
      userId,
      idempotencyKey: `order-delivered-${order.id}`,
    });
  }

  /**
   * 18. Order Cancelled
   */
  async sendOrderCancelledEmail(to, { customerName, order, cancellationReason, refundInfo, userId = null }) {
    const { subject, html, text } = templates.orderCancelledTemplate({
      customerName,
      order,
      cancellationReason,
      refundInfo,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'order-cancelled',
      orderId: order.id,
      userId,
      idempotencyKey: `order-cancelled-${order.id}`,
    });
  }

  /**
   * 19. Refund Initiated
   */
  async sendRefundInitiatedEmail(to, { customerName, order, refundAmount, refundId, estimatedDays, userId = null }) {
    const { subject, html, text } = templates.refundInitiatedTemplate({
      customerName,
      order,
      refundAmount,
      refundId,
      estimatedDays,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'refund-initiated',
      orderId: order.id,
      userId,
      idempotencyKey: `refund-init-${refundId || order.id}`,
    });
  }

  /**
   * 20. Refund Completed
   */
  async sendRefundCompletedEmail(to, { customerName, order, refundAmount, refundId, paymentMethod, userId = null }) {
    const { subject, html, text } = templates.refundCompletedTemplate({
      customerName,
      order,
      refundAmount,
      refundId,
      paymentMethod,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'refund-completed',
      orderId: order.id,
      userId,
      idempotencyKey: `refund-completed-${refundId || order.id}`,
    });
  }

  /**
   * 20b. Refund Processed Alias
   */
  async sendRefundProcessedEmail(to, { customerName, order, refund = null, amount, refundId = null, userId = null }) {
    return this.sendRefundCompletedEmail(to, {
      customerName,
      order,
      refundAmount: amount,
      refundId: refundId || refund?.razorpayRefundId || refund?.id,
      userId,
    });
  }

  /**
   * 20c. Return Requested
   */
  async sendReturnRequestedEmail(to, { customerName = 'Valued Clientele', order, reason, userId = null }) {
    const subject = `Return Request Received — Order #${order.orderNumber || order.id}`;
    const html = `<p>Dear ${customerName},</p><p>We have received your return request for Order <strong>#${order.orderNumber || order.id}</strong>.</p><p><strong>Reason provided:</strong> ${reason}</p><p>Our atelier concierge team is reviewing your request.</p>`;
    const text = `Return requested for order #${order.orderNumber || order.id}. Reason: ${reason}`;
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'return-requested',
      orderId: order.id,
      userId,
      idempotencyKey: `return-req-${order.id}`,
    });
  }

  /**
   * 20d. Return Approved
   */
  async sendReturnApprovedEmail(to, { customerName = 'Valued Clientele', order, pickupDetails = '', userId = null }) {
    const subject = `Return Approved — Order #${order.orderNumber || order.id}`;
    const html = `<p>Dear ${customerName},</p><p>Your return request for Order <strong>#${order.orderNumber || order.id}</strong> has been approved.</p><p>${pickupDetails || 'Our complimentary courier will arrive within 48 hours.'}</p>`;
    const text = `Return approved for order #${order.orderNumber || order.id}.`;
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'return-approved',
      orderId: order.id,
      userId,
      idempotencyKey: `return-appr-${order.id}`,
    });
  }

  // ==========================================
  // MARKETING EMAILS (4 TYPES)
  // ==========================================

  /**
   * 21. Newsletter Subscription Confirmation
   */
  async sendNewsletterSubscriptionConfirmation(to, { subscriberEmail, confirmUrl, unsubscribeUrl = null }) {
    const { subject, html, text } = templates.newsletterSubscriptionConfirmationTemplate({
      subscriberEmail: subscriberEmail || to,
      confirmUrl,
      unsubscribeUrl,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'newsletter-confirm',
      tags: ['marketing', 'newsletter'],
    });
  }

  /**
   * 22. Newsletter Welcome
   */
  async sendNewsletterWelcome(to, { subscriberEmail, discountCode, discountPercent, unsubscribeUrl = null }) {
    const { subject, html, text } = templates.newsletterWelcomeTemplate({
      subscriberEmail: subscriberEmail || to,
      discountCode,
      discountPercent,
      unsubscribeUrl,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'newsletter-welcome',
      idempotencyKey: `newsletter-welcome-${to}`,
      tags: ['marketing', 'newsletter'],
    });
  }

  /**
   * 23. Promotional Campaign
   */
  async sendPromotionalCampaign(to, {
    customerName,
    campaignTitle,
    heroImage,
    description,
    ctaLabel,
    ctaUrl,
    unsubscribeUrl,
    userId = null,
  }) {
    const { subject, html, text } = templates.promotionalCampaignTemplate({
      customerName,
      campaignTitle,
      heroImage,
      description,
      ctaLabel,
      ctaUrl,
      unsubscribeUrl,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'promotional-campaign',
      userId,
      tags: ['marketing', 'campaign'],
    });
  }

  /**
   * 24. Coupon / Offer Campaign
   */
  async sendCouponOfferEmail(to, {
    customerName,
    couponCode,
    discountText,
    minPurchase,
    expiryDate,
    ctaUrl,
    unsubscribeUrl,
    userId = null,
  }) {
    const { subject, html, text } = templates.couponOfferTemplate({
      customerName,
      couponCode,
      discountText,
      minPurchase,
      expiryDate,
      ctaUrl,
      unsubscribeUrl,
    });
    return this.sendMail({
      to,
      subject,
      html,
      text,
      templateName: 'coupon-offer',
      userId,
      tags: ['marketing', 'promotion'],
    });
  }

  // ==========================================
  // ADMIN NOTIFICATIONS (4 TYPES)
  // ==========================================

  /**
   * 25. Admin: New Order Notification
   */
  async sendAdminNewOrderAlert(adminEmail, { order, customerName, totalAmount }) {
    const target = adminEmail || env.ADMIN_NOTIFICATION_EMAIL || env.EMAIL_FROM_ADDRESS || 'concierge@forme.store';
    const { subject, html, text } = templates.adminNewOrderAlertTemplate({ order, customerName, totalAmount });
    return this.sendMail({
      to: target,
      subject,
      html,
      text,
      templateName: 'admin-new-order',
      orderId: order.id,
      idempotencyKey: `admin-alert-order-${order.id}`,
    });
  }

  /**
   * 26. Admin: Payment Issue Alert
   */
  async sendAdminPaymentIssueAlert(adminEmail, { orderId, paymentId, errorCode, errorDescription, customerEmail }) {
    const target = adminEmail || env.ADMIN_NOTIFICATION_EMAIL || env.EMAIL_FROM_ADDRESS || 'concierge@forme.store';
    const { subject, html, text } = templates.adminPaymentIssueAlertTemplate({
      orderId,
      paymentId,
      errorCode,
      errorDescription,
      customerEmail,
    });
    return this.sendMail({
      to: target,
      subject,
      html,
      text,
      templateName: 'admin-payment-issue',
      orderId,
    });
  }

  /**
   * 27. Admin: Low-Stock Alert
   */
  async sendAdminLowStockAlert(adminEmail, { productTitle, sku, variantAttributes, currentStock, threshold }) {
    const target = adminEmail || env.ADMIN_NOTIFICATION_EMAIL || env.EMAIL_FROM_ADDRESS || 'concierge@forme.store';
    const { subject, html, text } = templates.adminLowStockAlertTemplate({
      productTitle,
      sku,
      variantAttributes,
      currentStock,
      threshold,
    });
    return this.sendMail({
      to: target,
      subject,
      html,
      text,
      templateName: 'admin-low-stock',
      idempotencyKey: `low-stock-${sku}-${Date.now().toString().slice(0, -5)}`, // Throttled per hour
    });
  }

  /**
   * 28. Admin: Important / Critical Inventory Alert
   */
  async sendAdminInventoryCriticalAlert(adminEmail, { items, alertTime }) {
    const target = adminEmail || env.ADMIN_NOTIFICATION_EMAIL || env.EMAIL_FROM_ADDRESS || 'concierge@forme.store';
    const { subject, html, text } = templates.adminInventoryCriticalAlertTemplate({ items, alertTime });
    return this.sendMail({
      to: target,
      subject,
      html,
      text,
      templateName: 'admin-inventory-critical',
    });
  }

  // ==========================================
  // BACKWARDS COMPATIBILITY WRAPPERS
  // ==========================================
  async sendVerificationEmail(to, name = 'Valued Clientele', otp) {
    return this.sendRegistrationOTP(to, { name, otp });
  }

  async sendPasswordResetEmail(to, name = 'Valued Clientele', resetUrl) {
    return this.sendForgotPasswordEmail(to, { name, resetUrl });
  }

  /**
   * Health verification probe for both Nodemailer and Brevo providers.
   */
  async verifyProviders() {
    const nodemailer = getSpecificProvider('nodemailer');
    const brevo = getSpecificProvider('brevo');

    const [nodemailerStatus, brevoStatus] = await Promise.all([
      nodemailer.verifyConnection(),
      brevo.verifyConnection(),
    ]);

    return {
      activeProvider: env.EMAIL_PROVIDER || 'nodemailer',
      providers: {
        nodemailer: nodemailerStatus,
        brevo: brevoStatus,
      },
    };
  }
}

export const emailService = new EmailService();
export default emailService;
