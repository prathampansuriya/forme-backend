import { renderMasterEmailLayout } from './emailLayout.js';
import env from '../config/env.config.js';

const clientUrl = env.CLIENT_URL || 'http://localhost:5173';

// Currency formatter
const formatCurrency = (amount) => {
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(numeric);
};

// Helper: Render Order Items HTML Table
const renderOrderItemsTable = (items = []) => {
  if (!items || items.length === 0) return '';

  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #F5F3EF; vertical-align: top; width: 64px;">
        <img src="${item.imageUrl || 'https://res.cloudinary.com/dbtq4qk6s/image/upload/v1/forme/placeholder-garment.jpg'}" 
             alt="${item.title || 'Product'}" 
             width="54" height="68" 
             style="display: block; object-fit: cover; border: 1px solid #E7E5E4; border-radius: 1px;" />
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #F5F3EF; vertical-align: top;">
        <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 14px; font-weight: 600; color: #121212;">
          ${item.title || 'FORME Garment'}
        </div>
        <div style="font-size: 11px; color: #78716C; margin-top: 4px;">
          ${item.variantName || (item.size ? `Size: ${item.size}` : '') + (item.color ? ` &bull; Color: ${item.color}` : '')}
        </div>
        <div style="font-size: 11px; color: #A8A29E; margin-top: 2px;">
          Qty: ${item.quantity || 1} &times; ${formatCurrency(item.unitPrice || item.price)}
        </div>
      </td>
      <td align="right" style="padding: 12px 0; border-bottom: 1px solid #F5F3EF; vertical-align: top; font-weight: 600; font-size: 13px; color: #121212;">
        ${formatCurrency((item.quantity || 1) * (item.unitPrice || item.price || 0))}
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0;">
      <thead>
        <tr>
          <th align="left" colspan="2" style="font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #78716C; padding-bottom: 8px; border-bottom: 2px solid #121212;">Piece</th>
          <th align="right" style="font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #78716C; padding-bottom: 8px; border-bottom: 2px solid #121212;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

// Helper: Render Order Financial Summary
const renderFinancialSummary = (order) => {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 12px; font-size: 13px;">
      <tr>
        <td style="padding: 4px 0; color: #78716C;">Subtotal</td>
        <td align="right" style="padding: 4px 0; color: #121212;">${formatCurrency(order.subtotal || order.totalAmount)}</td>
      </tr>
      ${
        order.discountAmount && Number(order.discountAmount) > 0
          ? `<tr>
              <td style="padding: 4px 0; color: #15803D;">Privilege Deduction</td>
              <td align="right" style="padding: 4px 0; color: #15803D;">-${formatCurrency(order.discountAmount)}</td>
            </tr>`
          : ''
      }
      <tr>
        <td style="padding: 4px 0; color: #78716C;">White-Glove Delivery</td>
        <td align="right" style="padding: 4px 0; color: #121212;">${Number(order.shippingCost || 0) === 0 ? 'Complimentary' : formatCurrency(order.shippingCost)}</td>
      </tr>
      ${
        order.taxAmount && Number(order.taxAmount) > 0
          ? `<tr>
              <td style="padding: 4px 0; color: #78716C;">GST / Applicable Taxes</td>
              <td align="right" style="padding: 4px 0; color: #121212;">${formatCurrency(order.taxAmount)}</td>
            </tr>`
          : ''
      }
      <tr>
        <td style="padding: 12px 0 0; border-top: 1px solid #121212; font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: 700; color: #121212;">Grand Total</td>
        <td align="right" style="padding: 12px 0 0; border-top: 1px solid #121212; font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: 700; color: #121212;">${formatCurrency(order.totalAmount)}</td>
      </tr>
    </table>
  `;
};

// Helper: Render Address
const renderAddressSummary = (addr) => {
  if (!addr) return 'Address details on file';
  return `
    <strong>${addr.fullName || addr.name || 'Client'}</strong><br>
    ${addr.addressLine1 || addr.street || ''}${addr.addressLine2 ? `<br>${addr.addressLine2}` : ''}<br>
    ${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || addr.pinCode || ''}<br>
    ${addr.country || 'India'}<br>
    Phone: ${addr.phone || 'N/A'}
  `;
};

/**
 * 1. Order Placed
 */
export const orderPlacedTemplate = ({ customerName = 'Valued Clientele', order, orderItems = [], shippingAddress }) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>We are honored to have received your acquisition. Order reference <strong>#${order.orderNumber || order.id}</strong> is now registered with our maison.</p>

    <div style="background-color: #FAF8F5; border: 1px solid #E7E5E4; padding: 16px 20px; margin: 20px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 12px;">
        <tr>
          <td style="color: #78716C;">Order Reference:</td>
          <td align="right" style="font-weight: 600; color: #121212;">#${order.orderNumber || order.id}</td>
        </tr>
        <tr>
          <td style="color: #78716C; padding-top: 4px;">Payment Method:</td>
          <td align="right" style="color: #121212; padding-top: 4px;">${order.paymentMethod || 'Online Payment'}</td>
        </tr>
      </table>
    </div>

    ${renderOrderItemsTable(orderItems)}
    ${renderFinancialSummary(order)}

    <div style="margin-top: 28px; border-top: 1px solid #F5F3EF; padding-top: 20px; font-size: 12px; line-height: 18px; color: #78716C;">
      <strong>Delivery Destination:</strong><br>
      ${renderAddressSummary(shippingAddress)}
    </div>
  `;

  return {
    subject: `Acquisition Registered — Order #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Thank you for your order #${order.orderNumber || order.id}. We are preparing your pieces.`,
      heading: 'Acquisition Registered',
      subtitle: 'Your commission is currently being reviewed by our team',
      badge: 'Order Placed',
      contentHtml,
      ctaLabel: 'Review Order Status',
      ctaUrl: `${clientUrl}/account/orders/${order.id}`,
    }),
    text: `Dear ${customerName}, order #${order.orderNumber || order.id} has been placed. Total: ${formatCurrency(order.totalAmount)}.`,
  };
};

/**
 * 2. Order Confirmation
 */
export const orderConfirmationTemplate = ({ customerName = 'Valued Clientele', order, orderItems = [], shippingAddress }) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>Your acquisition has been confirmed. Our artisans and fulfillment atelier have commenced preparing your pieces with the utmost care.</p>

    ${renderOrderItemsTable(orderItems)}
    ${renderFinancialSummary(order)}

    <div style="background-color: #FAF8F5; border: 1px solid #C5A880; padding: 14px 20px; margin: 24px 0; font-size: 12px; color: #57534E;">
      <strong>White-Glove Promise:</strong> Each garment undergoes a four-stage quality inspection and hand-steaming before placement into our archival garment casing.
    </div>

    <div style="font-size: 12px; line-height: 18px; color: #78716C;">
      <strong>Shipping Address:</strong><br>
      ${renderAddressSummary(shippingAddress)}
    </div>
  `;

  return {
    subject: `Order Confirmed: #${order.orderNumber || order.id} — FORME`,
    html: renderMasterEmailLayout({
      preheader: `Your order #${order.orderNumber || order.id} is confirmed and in preparation`,
      heading: 'Order Confirmed',
      subtitle: 'Your couture selection is officially in preparation',
      badge: 'Confirmed',
      contentHtml,
      ctaLabel: 'View Order Details',
      ctaUrl: `${clientUrl}/account/orders/${order.id}`,
    }),
    text: `Dear ${customerName}, your order #${order.orderNumber || order.id} is officially confirmed.`,
  };
};

/**
 * 3. Payment Successful
 */
export const paymentSuccessfulTemplate = ({ customerName = 'Valued Clientele', order, payment = {} }) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>We confirm that payment of <strong>${formatCurrency(payment.amount || order.totalAmount)}</strong> for Order <strong>#${order.orderNumber || order.id}</strong> has been successfully captured.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border: 1px solid #E7E5E4; margin: 20px 0; font-size: 13px;">
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">Transaction ID</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-family: monospace;">${payment.transactionId || payment.id || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">Payment Method</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212;">${payment.method || 'Razorpay Secured'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; color: #78716C;">Amount Settled</td>
        <td style="padding: 10px 16px; font-weight: 600; color: #15803D;">${formatCurrency(payment.amount || order.totalAmount)}</td>
      </tr>
    </table>

    <p style="font-size: 12px; color: #78716C;">
      Your tax invoice has been generated and is available for download in your customer portal.
    </p>
  `;

  return {
    subject: `Payment Successful — Order #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Payment confirmed for order #${order.orderNumber || order.id}`,
      heading: 'Payment Confirmed',
      subtitle: 'Transaction settled successfully through secure gateway',
      badge: 'Payment Captured',
      contentHtml,
      ctaLabel: 'Download Invoice',
      ctaUrl: `${clientUrl}/account/orders/${order.id}`,
    }),
    text: `Payment of ${formatCurrency(payment.amount || order.totalAmount)} for Order #${order.orderNumber || order.id} succeeded.`,
  };
};

/**
 * 4. Payment Failed
 */
export const paymentFailedTemplate = ({ customerName = 'Valued Clientele', order, payment = {}, retryUrl }) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>We encountered an issue while processing payment for Order <strong>#${order.orderNumber || order.id}</strong>.</p>

    <div style="background-color: #FEF2F2; border: 1px solid #F87171; padding: 14px 20px; margin: 20px 0; font-size: 13px; color: #991B1B;">
      <strong>Transaction Status:</strong> Unsuccessful<br>
      Reason: ${payment.errorMessage || 'Card or payment authorization was declined by your financial institution.'}
    </div>

    <p>Your selected pieces have been temporarily reserved for <strong>30 minutes</strong> to ensure you do not miss your size.</p>
  `;

  return {
    subject: `Payment Unsuccessful: Order #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Payment issue with order #${order.orderNumber || order.id}. Action required.`,
      heading: 'Payment Unsuccessful',
      subtitle: 'Your reserved pieces remain held temporarily',
      badge: 'Action Required',
      contentHtml,
      ctaLabel: 'Retry Payment',
      ctaUrl: retryUrl || `${clientUrl}/checkout?orderId=${order.id}`,
    }),
    text: `Payment for Order #${order.orderNumber || order.id} failed. Please retry at: ${retryUrl || clientUrl}`,
  };
};

/**
 * 5. COD Order Confirmation
 */
export const codOrderConfirmationTemplate = ({ customerName = 'Valued Clientele', order, confirmationUrl }) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>You have chosen Cash on Delivery (COD) for Order <strong>#${order.orderNumber || order.id}</strong> (Total: <strong>${formatCurrency(order.totalAmount)}</strong>).</p>
    <p>To confirm delivery intent and dispatch your package immediately, please click the verification button below:</p>
  `;

  return {
    subject: `Action Required: Confirm COD Order #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Please confirm your Cash on Delivery order #${order.orderNumber || order.id}`,
      heading: 'Confirm Cash on Delivery',
      subtitle: 'One-click verification to release shipment',
      badge: 'Action Required',
      contentHtml,
      ctaLabel: 'Confirm Order Dispatch',
      ctaUrl: confirmationUrl || `${clientUrl}/account/orders/${order.id}/confirm-cod`,
    }),
    text: `Please confirm your COD Order #${order.orderNumber || order.id} at ${confirmationUrl || clientUrl}.`,
  };
};

/**
 * 6. Order Processing
 */
export const orderProcessingTemplate = ({ customerName = 'Valued Clientele', order }) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>Your order <strong>#${order.orderNumber || order.id}</strong> is now actively processing at our central fulfillment atelier.</p>
    <p>Our quality assurance team is performing individual fabric checks, seam inspections, and packaging in our custom archival boxes.</p>
  `;

  return {
    subject: `Order in Processing — #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Your garments for order #${order.orderNumber || order.id} are being prepared`,
      heading: 'In Processing',
      subtitle: 'Hand-inspected and curated at our atelier',
      badge: 'Processing',
      contentHtml,
      ctaLabel: 'Track Progress',
      ctaUrl: `${clientUrl}/account/orders/${order.id}`,
    }),
    text: `Order #${order.orderNumber || order.id} is now actively processing.`,
  };
};

/**
 * 7. Order Packed
 */
export const orderPackedTemplate = ({ customerName = 'Valued Clientele', order, packageDetails = '1 Parcel' }) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>Every piece in your order <strong>#${order.orderNumber || order.id}</strong> has passed final inspection and is now packed inside our luxury casing.</p>
    <p>The package has been sealed with our bespoke security ribbon and handed to our premium logistics partner.</p>
  `;

  return {
    subject: `Order Packed & Sealed — #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Order #${order.orderNumber || order.id} has been packed and prepared for transit`,
      heading: 'Parcel Sealed',
      subtitle: 'Ready for handover to our white-glove courier',
      badge: 'Packed',
      contentHtml,
      ctaLabel: 'View Package Details',
      ctaUrl: `${clientUrl}/account/orders/${order.id}`,
    }),
    text: `Order #${order.orderNumber || order.id} has been safely packed and sealed.`,
  };
};

/**
 * 8. Order Shipped
 */
export const orderShippedTemplate = ({
  customerName = 'Valued Clientele',
  order,
  shipment = {},
  trackingUrl,
  courierName = 'Bluedart Express',
}) => {
  const trackingNumber = shipment.trackingNumber || order.trackingNumber || 'Available in portal';

  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>Your curated selection for Order <strong>#${order.orderNumber || order.id}</strong> is now on its way to you.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border: 1px solid #E7E5E4; margin: 20px 0; font-size: 13px;">
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">Logistics Carrier</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-weight: 600;">${courierName}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">AWB / Tracking Number</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-family: monospace;">${trackingNumber}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; color: #78716C;">Estimated Delivery</td>
        <td style="padding: 10px 16px; color: #121212;">${shipment.estimatedDeliveryDate || '2-4 Business Days'}</td>
      </tr>
    </table>
  `;

  return {
    subject: `Your FORME Pieces Have Shipped — #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Your order #${order.orderNumber || order.id} is in transit via ${courierName}`,
      heading: 'Dispatched for Delivery',
      subtitle: 'Your garments are currently in transit',
      badge: 'In Transit',
      contentHtml,
      ctaLabel: 'Track Shipment Live',
      ctaUrl: trackingUrl || `${clientUrl}/account/orders/${order.id}`,
    }),
    text: `Your order #${order.orderNumber || order.id} has shipped via ${courierName}. Tracking: ${trackingNumber}.`,
  };
};

/**
 * 9. Order Out for Delivery
 */
export const orderOutForDeliveryTemplate = ({
  customerName = 'Valued Clientele',
  order,
  deliveryAgentName = 'Logistics Representative',
  deliveryDate = 'Today',
}) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>Your package for Order <strong>#${order.orderNumber || order.id}</strong> is out for delivery and will arrive <strong>${deliveryDate}</strong>.</p>
    <p>Please ensure someone is available at the destination address to receive and sign for your luxury parcel.</p>
  `;

  return {
    subject: `Out for Delivery Today — Order #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Order #${order.orderNumber || order.id} is arriving today`,
      heading: 'Out for Delivery',
      subtitle: 'Your courier is in your neighborhood',
      badge: 'Arriving Today',
      contentHtml,
      ctaLabel: 'View Live Delivery Status',
      ctaUrl: `${clientUrl}/account/orders/${order.id}`,
    }),
    text: `Order #${order.orderNumber || order.id} is out for delivery today.`,
  };
};

/**
 * 10. Order Delivered
 */
export const orderDeliveredTemplate = ({
  customerName = 'Valued Clientele',
  order,
  deliveryDate = 'Today',
  reviewUrl,
}) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>Our records indicate that Order <strong>#${order.orderNumber || order.id}</strong> has been successfully hand-delivered.</p>
    <p>We trust the garments meet every expectation of fit, texture, and craftsmanship. We would be honored to receive your impressions.</p>
  `;

  return {
    subject: `Delivered: Your FORME Acquisition #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Your FORME order #${order.orderNumber || order.id} has been delivered`,
      heading: 'Delivered',
      subtitle: 'Thank you for choosing FORME Contemporary Fashion',
      badge: 'Delivered',
      contentHtml,
      ctaLabel: 'Share Your Impression',
      ctaUrl: reviewUrl || `${clientUrl}/account/orders/${order.id}/review`,
    }),
    text: `Your order #${order.orderNumber || order.id} has been delivered. Thank you for choosing FORME.`,
  };
};

/**
 * 11. Order Cancelled
 */
export const orderCancelledTemplate = ({
  customerName = 'Valued Clientele',
  order,
  cancellationReason = 'Customer Request',
  refundInfo = 'Any processed payments will be refunded in 3-5 business days.',
}) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>This correspondence confirms that Order <strong>#${order.orderNumber || order.id}</strong> has been cancelled.</p>
    
    <div style="background-color: #FAF8F5; border: 1px solid #E7E5E4; padding: 14px 20px; margin: 20px 0; font-size: 13px;">
      <strong>Cancellation Reason:</strong> ${cancellationReason}<br>
      <strong>Refund Status:</strong> ${refundInfo}
    </div>
  `;

  return {
    subject: `Order Cancelled: #${order.orderNumber || order.id} — FORME`,
    html: renderMasterEmailLayout({
      preheader: `Order #${order.orderNumber || order.id} has been cancelled`,
      heading: 'Order Cancelled',
      subtitle: 'Confirmation of order cancellation',
      badge: 'Cancelled',
      contentHtml,
      ctaLabel: 'Visit the Storefront',
      ctaUrl: `${clientUrl}/shop`,
    }),
    text: `Order #${order.orderNumber || order.id} was cancelled. Reason: ${cancellationReason}.`,
  };
};

/**
 * 12. Refund Initiated
 */
export const refundInitiatedTemplate = ({
  customerName = 'Valued Clientele',
  order,
  refundAmount,
  refundId = 'N/A',
  estimatedDays = '3 to 5 business days',
}) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>A refund of <strong>${formatCurrency(refundAmount || order.totalAmount)}</strong> has been initiated for Order <strong>#${order.orderNumber || order.id}</strong>.</p>
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border: 1px solid #E7E5E4; margin: 20px 0; font-size: 13px;">
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">Refund ID</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-family: monospace;">${refundId}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; color: #78716C;">Estimated Processing</td>
        <td style="padding: 10px 16px; color: #121212;">${estimatedDays}</td>
      </tr>
    </table>
  `;

  return {
    subject: `Refund Initiated — Order #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Refund of ${formatCurrency(refundAmount || order.totalAmount)} initiated for order #${order.orderNumber || order.id}`,
      heading: 'Refund Initiated',
      subtitle: 'The amount is being returned to your original payment method',
      badge: 'Refund Processing',
      contentHtml,
      ctaLabel: 'View Account History',
      ctaUrl: `${clientUrl}/account/orders`,
    }),
    text: `Refund of ${formatCurrency(refundAmount || order.totalAmount)} initiated for order #${order.orderNumber || order.id}.`,
  };
};

/**
 * 13. Refund Completed
 */
export const refundCompletedTemplate = ({
  customerName = 'Valued Clientele',
  order,
  refundAmount,
  refundId = 'N/A',
  paymentMethod = 'Original Payment Source',
}) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>We confirm that the refund of <strong>${formatCurrency(refundAmount || order.totalAmount)}</strong> for Order <strong>#${order.orderNumber || order.id}</strong> has been successfully settled.</p>
    <p>The funds should now reflect in your ${paymentMethod} account.</p>
  `;

  return {
    subject: `Refund Completed — Order #${order.orderNumber || order.id}`,
    html: renderMasterEmailLayout({
      preheader: `Your refund for order #${order.orderNumber || order.id} is complete`,
      heading: 'Refund Completed',
      subtitle: 'Funds successfully credited to your payment method',
      badge: 'Refund Settled',
      contentHtml,
      ctaLabel: 'Review Transactions',
      ctaUrl: `${clientUrl}/account/orders`,
    }),
    text: `Your refund for Order #${order.orderNumber || order.id} has been settled.`,
  };
};

export default {
  orderPlacedTemplate,
  orderConfirmationTemplate,
  paymentSuccessfulTemplate,
  paymentFailedTemplate,
  codOrderConfirmationTemplate,
  orderProcessingTemplate,
  orderPackedTemplate,
  orderShippedTemplate,
  orderOutForDeliveryTemplate,
  orderDeliveredTemplate,
  orderCancelledTemplate,
  refundInitiatedTemplate,
  refundCompletedTemplate,
};

