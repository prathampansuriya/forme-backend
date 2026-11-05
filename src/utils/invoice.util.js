export const generateInvoiceData = (order) => {
  if (!order) return null;

  const invoiceNumber = `INV-${order.orderNumber.replace(/^FRM-/, '')}`;
  const issueDate = order.placedAt ? new Date(order.placedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  const shippingSnap = order.shippingAddressSnapshot || {};
  const billingSnap = order.billingAddressSnapshot || shippingSnap;

  // Items mapped
  const items = (order.items || []).map((item, index) => {
    const unitPrice = Number(item.unitSellingPrice);
    const qty = Number(item.quantity);
    const tax = Number(item.tax || 0);
    const lineTotal = Number(item.finalItemAmount);
    const mrp = Number(item.compareAtPrice || item.unitSellingPrice);
    const discount = Number(item.applicableDiscount || 0);

    return {
      itemIndex: index + 1,
      id: item.id,
      productName: item.productName,
      sku: item.sku,
      selectedSize: item.selectedSize,
      selectedColor: item.selectedColor,
      quantity: qty,
      unitPrice,
      mrp,
      discount,
      tax,
      lineTotal,
      productImage: item.productImage,
    };
  });

  const primaryPayment = (order.payments && order.payments.length > 0) ? order.payments[0] : null;

  return {
    invoiceNumber,
    issueDate,
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentDetails: primaryPayment
      ? {
          id: primaryPayment.id,
          razorpayPaymentId: primaryPayment.razorpayPaymentId || 'N/A',
          razorpayOrderId: primaryPayment.razorpayOrderId || 'N/A',
          status: primaryPayment.status,
          capturedAt: primaryPayment.capturedAt,
        }
      : null,
    seller: {
      name: 'FORME Contemporary Fashion House',
      registeredEntity: 'FORME Haute Couture Atelier India Private Limited',
      address: 'Runway House, 44 Couture Boulevard, Lower Parel',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400013',
      country: 'India',
      gstin: '27AABCU9603R1ZM',
      pan: 'AABCU9603R',
      supportEmail: 'concierge@forme.store',
      supportPhone: '+91 (0) 22 8900 1200',
    },
    customer: {
      name: order.user ? order.user.name : shippingSnap.recipientName,
      email: order.user ? order.user.email : null,
      phone: shippingSnap.phone,
    },
    shippingAddress: {
      recipientName: shippingSnap.recipientName,
      phone: shippingSnap.phone,
      addressLine1: shippingSnap.addressLine1,
      addressLine2: shippingSnap.addressLine2,
      landmark: shippingSnap.landmark,
      city: shippingSnap.city,
      state: shippingSnap.state,
      postalCode: shippingSnap.postalCode,
      country: shippingSnap.country || 'India',
    },
    billingAddress: {
      recipientName: billingSnap.recipientName,
      phone: billingSnap.phone,
      addressLine1: billingSnap.addressLine1,
      addressLine2: billingSnap.addressLine2,
      landmark: billingSnap.landmark,
      city: billingSnap.city,
      state: billingSnap.state,
      postalCode: billingSnap.postalCode,
      country: billingSnap.country || 'India',
    },
    items,
    financialSummary: {
      currency: order.currency || 'INR',
      mrpSubtotal: Number(order.mrpSubtotal),
      itemSubtotal: Number(order.itemSubtotal),
      offerDiscount: Number(order.offerDiscount || 0),
      flashSaleDiscount: Number(order.flashSaleDiscount || 0),
      couponDiscount: Number(order.couponDiscount || 0),
      totalDiscount: Number(order.offerDiscount || 0) + Number(order.flashSaleDiscount || 0) + Number(order.couponDiscount || 0),
      tax: Number(order.tax),
      taxBreakdown: {
        cgst: Number(order.tax) / 2,
        sgst: Number(order.tax) / 2,
        cgstRate: '6.00%',
        sgstRate: '6.00%',
      },
      shipping: Number(order.shipping),
      grandTotal: Number(order.grandTotal),
    },
    breakdownAudit: order.pricingBreakdown,
  };
};

export const generateInvoiceHtml = (order) => {
  const data = generateInvoiceData(order);
  if (!data) return '';

  const {
    invoiceNumber,
    issueDate,
    orderNumber,
    orderStatus,
    paymentStatus,
    paymentMethod,
    seller,
    shippingAddress,
    billingAddress,
    items,
    financialSummary,
  } = data;

  const itemRows = items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #F0EEEA;">
        <td style="padding: 16px 12px; font-family: 'Courier New', monospace; font-size: 11px; color: #78716C;">${item.sku}</td>
        <td style="padding: 16px 12px;">
          <div style="font-weight: 500; font-size: 13px; color: #1C1917;">${item.productName}</div>
          <div style="font-size: 11px; color: #78716C; margin-top: 3px;">Size: <strong>${item.selectedSize}</strong> &bull; Color: <strong>${item.selectedColor}</strong></div>
        </td>
        <td style="padding: 16px 12px; text-align: center; font-size: 13px; color: #1C1917;">${item.quantity}</td>
        <td style="padding: 16px 12px; text-align: right; font-size: 13px; color: #1C1917;">₹${item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 16px 12px; text-align: right; font-size: 13px; color: #78716C;">₹${item.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 16px 12px; text-align: right; font-size: 13px; font-weight: 600; color: #1C1917;">₹${item.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice — ${invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; background: #FAF9F6; color: #1C1917; }
    .invoice-card { max-width: 860px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E7E5E4; padding: 48px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
    .atelier-title { font-size: 28px; font-weight: 300; letter-spacing: 0.15em; text-transform: uppercase; margin: 0; color: #0C0A09; }
    .atelier-tag { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #A8A29E; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <table style="width: 100%; border-bottom: 2px solid #1C1917; padding-bottom: 24px;">
      <tr>
        <td>
          <h1 class="atelier-title">FORME</h1>
          <div class="atelier-tag">Contemporary Fashion House</div>
          <div style="font-size: 11px; color: #78716C; margin-top: 12px; line-height: 1.5;">
            ${seller.registeredEntity}<br/>
            ${seller.address}, ${seller.city}, ${seller.state} — ${seller.postalCode}<br/>
            <strong>GSTIN:</strong> ${seller.gstin} | <strong>PAN:</strong> ${seller.pan}
          </div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div style="font-size: 18px; font-weight: 600; letter-spacing: 0.05em; color: #1C1917;">TAX INVOICE</div>
          <div style="font-family: 'Courier New', monospace; font-size: 13px; font-weight: 600; margin-top: 6px; color: #78716C;">${invoiceNumber}</div>
          <div style="font-size: 12px; color: #78716C; margin-top: 4px;">Date: ${issueDate}</div>
          <div style="font-size: 12px; color: #78716C;">Order: <strong>${orderNumber}</strong></div>
          <div style="display: inline-block; margin-top: 8px; padding: 4px 10px; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; background: #F5F5F4; border-radius: 4px;">
            ${paymentMethod} &bull; ${paymentStatus}
          </div>
        </td>
      </tr>
    </table>

    <table style="width: 100%; margin-top: 32px; font-size: 12px; line-height: 1.6;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding-right: 20px;">
          <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #A8A29E; margin-bottom: 6px;">Billed To</div>
          <div style="font-size: 14px; font-weight: 600; color: #1C1917;">${billingAddress.recipientName}</div>
          <div style="color: #57534E;">${billingAddress.addressLine1}${billingAddress.addressLine2 ? ', ' + billingAddress.addressLine2 : ''}</div>
          ${billingAddress.landmark ? `<div style="color: #78716C;">Near ${billingAddress.landmark}</div>` : ''}
          <div style="color: #57534E;">${billingAddress.city}, ${billingAddress.state} — ${billingAddress.postalCode}</div>
          <div style="color: #78716C; margin-top: 4px;">Phone: ${billingAddress.phone}</div>
        </td>
        <td style="width: 50%; vertical-align: top; padding-left: 20px;">
          <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #A8A29E; margin-bottom: 6px;">Shipped To</div>
          <div style="font-size: 14px; font-weight: 600; color: #1C1917;">${shippingAddress.recipientName}</div>
          <div style="color: #57534E;">${shippingAddress.addressLine1}${shippingAddress.addressLine2 ? ', ' + shippingAddress.addressLine2 : ''}</div>
          ${shippingAddress.landmark ? `<div style="color: #78716C;">Near ${shippingAddress.landmark}</div>` : ''}
          <div style="color: #57534E;">${shippingAddress.city}, ${shippingAddress.state} — ${shippingAddress.postalCode}</div>
          <div style="color: #78716C; margin-top: 4px;">Phone: ${shippingAddress.phone}</div>
        </td>
      </tr>
    </table>

    <table style="width: 100%; margin-top: 36px; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid #E7E5E4; background: #FAF9F6;">
          <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #78716C;">SKU</th>
          <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #78716C;">Garment Specification</th>
          <th style="padding: 12px; text-align: center; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #78716C;">Qty</th>
          <th style="padding: 12px; text-align: right; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #78716C;">Unit Price</th>
          <th style="padding: 12px; text-align: right; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #78716C;">GST (12%)</th>
          <th style="padding: 12px; text-align: right; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #78716C;">Net Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <table style="width: 100%; margin-top: 24px;">
      <tr>
        <td style="width: 50%; vertical-align: top; font-size: 11px; color: #78716C; line-height: 1.6;">
          <div style="font-weight: 600; color: #44403C; margin-bottom: 4px;">Payment Reference:</div>
          <div>Method: ${paymentMethod}</div>
          ${data.paymentDetails?.razorpayPaymentId ? `<div>Transaction Ref: ${data.paymentDetails.razorpayPaymentId}</div>` : ''}
          <div style="margin-top: 12px; color: #A8A29E; font-size: 10px;">
            This is a computer-generated luxury tax invoice. No signature required.<br/>
            All garments inspected and sealed by FORME Haute Couture Atelier.
          </div>
        </td>
        <td style="width: 50%; vertical-align: top;">
          <table style="width: 100%; font-size: 13px; line-height: 1.8;">
            <tr>
              <td style="color: #78716C;">MRP Subtotal</td>
              <td style="text-align: right; color: #78716C;">₹${financialSummary.mrpSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            ${
              financialSummary.totalDiscount > 0
                ? `<tr>
              <td style="color: #059669;">Promotional Markdowns</td>
              <td style="text-align: right; color: #059669;">-₹${financialSummary.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>`
                : ''
            }
            <tr>
              <td style="color: #78716C;">Net Item Subtotal</td>
              <td style="text-align: right; color: #1C1917;">₹${financialSummary.itemSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="color: #78716C;">CGST (6.00%)</td>
              <td style="text-align: right; color: #78716C;">₹${financialSummary.taxBreakdown.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="color: #78716C;">SGST (6.00%)</td>
              <td style="text-align: right; color: #78716C;">₹${financialSummary.taxBreakdown.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="color: #78716C;">White Glove Express Delivery</td>
              <td style="text-align: right; color: #1C1917;">${financialSummary.shipping === 0 ? '<span style="color: #059669; font-weight: 600;">COMPLIMENTARY</span>' : '₹' + financialSummary.shipping.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr style="border-top: 2px solid #1C1917; font-size: 16px; font-weight: 700;">
              <td style="padding-top: 8px; color: #0C0A09;">Grand Total</td>
              <td style="padding-top: 8px; text-align: right; color: #0C0A09;">₹${financialSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
};
