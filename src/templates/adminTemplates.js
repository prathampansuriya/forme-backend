import { renderMasterEmailLayout } from './emailLayout.js';
import env from '../config/env.config.js';

const clientUrl = env.CLIENT_URL || 'http://localhost:5173';

const formatCurrency = (amount) => {
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(numeric);
};

/**
 * 1. Admin: New Order Notification
 */
export const adminNewOrderAlertTemplate = ({
  order,
  customerName = 'Guest Patron',
  totalAmount,
}) => {
  const contentHtml = `
    <p>Operational Attention Required:</p>
    <p>A new commission has been placed on the FORME storefront by <strong>${customerName}</strong>.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border: 1px solid #E7E5E4; margin: 20px 0; font-size: 13px;">
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C; width: 35%;">Order Reference</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-weight: 600;">#${order.orderNumber || order.id}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">Customer Name</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212;">${customerName}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">Payment Method</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212;">${order.paymentMethod || 'Razorpay'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; color: #78716C;">Commission Value</td>
        <td style="padding: 10px 16px; font-weight: 700; color: #15803D;">${formatCurrency(totalAmount || order.totalAmount)}</td>
      </tr>
    </table>

    <p style="font-size: 12px; color: #78716C;">
      Please inspect inventory reservation and release to fulfillment atelier within standard SLA.
    </p>
  `;

  return {
    subject: `[ADMIN ALERT] New Order Received #${order.orderNumber || order.id} — ${formatCurrency(totalAmount || order.totalAmount)}`,
    html: renderMasterEmailLayout({
      preheader: `New order #${order.orderNumber || order.id} placed for ${formatCurrency(totalAmount || order.totalAmount)}`,
      heading: 'New Order Notification',
      subtitle: 'Real-time commerce event notification for atelier operations',
      badge: 'Order Received',
      contentHtml,
      ctaLabel: 'Open in Admin Dashboard',
      ctaUrl: `${clientUrl}/admin/orders/${order.id}`,
      isAdmin: true,
    }),
    text: `New order #${order.orderNumber || order.id} by ${customerName} for ${formatCurrency(totalAmount || order.totalAmount)}.`,
  };
};

/**
 * 2. Admin: Payment Issue Notification
 */
export const adminPaymentIssueAlertTemplate = ({
  orderId,
  paymentId,
  errorCode = 'GATEWAY_ERROR',
  errorDescription = 'Transaction declined or gateway timeout',
  customerEmail = 'Unknown',
}) => {
  const contentHtml = `
    <p>High Priority Alert:</p>
    <p>A payment transaction failed or encountered an anomaly during checkout.</p>

    <div style="background-color: #FEF2F2; border: 1px solid #F87171; padding: 16px 20px; margin: 20px 0; font-size: 13px; color: #991B1B;">
      <strong>Error Code:</strong> ${errorCode}<br>
      <strong>Description:</strong> ${errorDescription}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border: 1px solid #E7E5E4; margin: 16px 0; font-size: 13px;">
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C; width: 35%;">Order ID</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-family: monospace;">${orderId || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">Payment Ref</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-family: monospace;">${paymentId || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; color: #78716C;">Customer Contact</td>
        <td style="padding: 10px 16px; color: #121212;">${customerEmail}</td>
      </tr>
    </table>
  `;

  return {
    subject: `[URGENT] Payment Settlement Anomaly: Order ${orderId || 'Checkout'}`,
    html: renderMasterEmailLayout({
      preheader: `Payment failure detected on order ${orderId}: ${errorCode}`,
      heading: 'Payment Issue Detected',
      subtitle: 'Immediate concierge intervention may be warranted',
      badge: 'Payment Anomaly',
      contentHtml,
      ctaLabel: 'Investigate in Command Center',
      ctaUrl: `${clientUrl}/admin/orders/${orderId}`,
      isAdmin: true,
    }),
    text: `Payment failure alert: Order ${orderId}, Payment ${paymentId}, Error: ${errorCode} - ${errorDescription}`,
  };
};

/**
 * 3. Admin: Low-Stock Alert
 */
export const adminLowStockAlertTemplate = ({
  productTitle,
  sku,
  variantAttributes = 'Standard',
  currentStock = 0,
  threshold = 5,
}) => {
  const contentHtml = `
    <p>Inventory Advisory:</p>
    <p>A luxury silhouette has breached minimum inventory thresholds and requires replenishment review.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border: 1px solid #E7E5E4; margin: 20px 0; font-size: 13px;">
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C; width: 35%;">Garment Title</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-weight: 600;">${productTitle}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">SKU / Variant</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-family: monospace;">${sku} (${variantAttributes})</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">Current Stock</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; font-weight: 700; color: ${currentStock === 0 ? '#B91C1C' : '#D97706'};">
          ${currentStock} unit${currentStock === 1 ? '' : 's'} remaining
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; color: #78716C;">Threshold</td>
        <td style="padding: 10px 16px; color: #121212;">${threshold} units</td>
      </tr>
    </table>
  `;

  return {
    subject: `[INVENTORY ALERT] Low Stock: ${productTitle} (${sku}) — ${currentStock} Remaining`,
    html: renderMasterEmailLayout({
      preheader: `Low stock alert: ${productTitle} (${sku}) has ${currentStock} units left`,
      heading: 'Low Stock Advisory',
      subtitle: 'Inventory levels approaching depletion threshold',
      badge: 'Stock Warning',
      contentHtml,
      ctaLabel: 'Manage Stock in Inventory Hub',
      ctaUrl: `${clientUrl}/admin/inventory`,
      isAdmin: true,
    }),
    text: `Low stock alert: ${productTitle} (${sku}) - Current stock: ${currentStock}, Threshold: ${threshold}`,
  };
};

/**
 * 4. Admin: Critical Inventory Alert (Multiple Out-of-Stock items)
 */
export const adminInventoryCriticalAlertTemplate = ({
  items = [],
  alertTime = new Date().toUTCString(),
}) => {
  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #F5F3EF; font-weight: 600; color: #121212;">${item.title || item.sku}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #F5F3EF; font-family: monospace; color: #78716C;">${item.sku}</td>
      <td align="right" style="padding: 10px 14px; border-bottom: 1px solid #F5F3EF; font-weight: 700; color: #B91C1C;">
        ${item.stock === 0 ? 'DEPLETED' : `${item.stock} left`}
      </td>
    </tr>
  `
    )
    .join('');

  const contentHtml = `
    <p>Critical Operations Alert:</p>
    <p>Multiple high-demand silhouettes have reached critical inventory depletion as of <strong>${alertTime}</strong>.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; font-size: 12px; border: 1px solid #E7E5E4;">
      <thead>
        <tr style="background-color: #FAF8F5;">
          <th align="left" style="padding: 8px 14px; color: #78716C;">Garment</th>
          <th align="left" style="padding: 8px 14px; color: #78716C;">SKU</th>
          <th align="right" style="padding: 8px 14px; color: #78716C;">Stock Level</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  `;

  return {
    subject: `[CRITICAL ALERT] Inventory Depletion across ${items.length} Silhouettes`,
    html: renderMasterEmailLayout({
      preheader: `Critical stock alert: ${items.length} silhouettes depleted or near zero`,
      heading: 'Critical Inventory Depletion',
      subtitle: 'Immediate production replenishment action advised',
      badge: 'Critical Inventory',
      contentHtml,
      ctaLabel: 'Inspect Atelier Inventory',
      ctaUrl: `${clientUrl}/admin/inventory`,
      isAdmin: true,
    }),
    text: `Critical stock alert: ${items.length} items depleted or near zero as of ${alertTime}.`,
  };
};

export default {
  adminNewOrderAlertTemplate,
  adminPaymentIssueAlertTemplate,
  adminLowStockAlertTemplate,
  adminInventoryCriticalAlertTemplate,
};

