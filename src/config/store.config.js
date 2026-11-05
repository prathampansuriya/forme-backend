export const storeConfig = {
  name: 'FORME',
  tagline: 'Designed to Be Worn. Made to Be Remembered.',
  currency: {
    code: 'INR',
    symbol: '₹',
    locale: 'en-IN',
  },
  shipping: {
    freeShippingThreshold: 5000.0, // Free White Glove delivery for orders >= ₹5,000
    standardRate: 250.0,           // ₹250 flat rate below threshold
  },
  tax: {
    defaultGstRate: 12.0,          // 12% GST standard on luxury garments
    intraStateCgst: 6.0,           // 6% CGST
    intraStateSgst: 6.0,           // 6% SGST
    interStateIgst: 12.0,          // 12% IGST
  },
  inventory: {
    reservationTtlMinutes: 15,     // 15-minute optimistic hold
    lowStockThreshold: 5,          // Low stock alert flag
  },
  support: {
    conciergeEmail: 'concierge@forme.store',
    phone: '+91 22 8920 1900',
  },
};

export default storeConfig;

