import { z } from 'zod';

const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{8,15}$/;
const postalCodeRegex = /^[0-9]{6}$/;

const addressInputSchema = z.object({
  recipientName: z.string().trim().min(2, 'Recipient name must be at least 2 characters').max(100),
  phone: z.string().trim().regex(phoneRegex, 'Please provide a valid contact phone number'),
  addressLine1: z.string().trim().min(3, 'Address line 1 is required').max(200),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  landmark: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().min(2, 'City is required').max(100),
  state: z.string().trim().min(2, 'State is required').max(100),
  postalCode: z.string().trim().min(3, 'Postal code must be at least 3 characters').max(10),
  country: z.string().trim().default('India'),
});

export const checkoutSchema = z.object({
  body: z
    .object({
      shippingAddressId: z.string().uuid().optional().nullable(),
      shippingAddress: addressInputSchema.optional().nullable(),
      billingAddressId: z.string().uuid().optional().nullable(),
      billingAddress: addressInputSchema.optional().nullable(),
      useShippingForBilling: z.boolean().default(true),
      paymentMethod: z.enum(['RAZORPAY_UPI', 'RAZORPAY_CARD', 'RAZORPAY_NETBANKING', 'COD']),
      customerNotes: z.string().trim().max(1000).optional().nullable(),
      couponCode: z.string().trim().toUpperCase().optional().nullable(),
      checkoutSessionId: z.string().trim().optional().nullable(),
      directCheckoutItem: z
        .object({
          variantId: z.string().uuid(),
          quantity: z.number().int().min(1).max(10).default(1),
        })
        .optional()
        .nullable(),
    })
    .refine(
      (data) => Boolean(data.shippingAddressId || data.shippingAddress),
      {
        message: 'Either shippingAddressId or an inline shippingAddress must be provided',
        path: ['shippingAddressId'],
      }
    ),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Valid order ID required'),
    razorpayOrderId: z.string().min(1, 'Razorpay order ID required'),
    razorpayPaymentId: z.string().min(1, 'Razorpay payment ID required'),
    razorpaySignature: z.string().min(1, 'Razorpay signature required'),
  }),
});

export const paymentFailureSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Valid order ID required'),
    razorpayOrderId: z.string().optional().nullable(),
    failureReason: z.string().max(500).default('Payment was declined or cancelled by the user'),
  }),
});

export const queryOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    orderStatus: z
      .enum([
        'PENDING',
        'PLACED',
        'CONFIRMED',
        'PROCESSING',
        'PACKED',
        'SHIPPED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'RETURN_REQUESTED',
        'RETURN_APPROVED',
        'RETURNED',
      ])
      .optional(),
    paymentStatus: z
      .enum(['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
      .optional(),
    paymentMethod: z.enum(['RAZORPAY_UPI', 'RAZORPAY_CARD', 'RAZORPAY_NETBANKING', 'COD']).optional(),
    search: z.string().trim().optional(),
    startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    sortBy: z.enum(['placedAt', 'grandTotal', 'orderNumber']).default('placedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const cancelOrderSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters').max(500),
  }),
});

export const returnOrderSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(3, 'Return reason must be at least 3 characters').max(500),
    itemIds: z.array(z.string().uuid()).optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      'PENDING',
      'PLACED',
      'CONFIRMED',
      'PROCESSING',
      'PACKED',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'RETURN_REQUESTED',
      'RETURN_APPROVED',
      'RETURNED',
    ]),
    comment: z.string().trim().max(1000).optional().nullable(),
  }),
});

export const shipOrderSchema = z.object({
  body: z.object({
    carrier: z.string().trim().min(2, 'Carrier name required').max(100),
    trackingNumber: z.string().trim().min(3, 'Tracking number required').max(100),
    trackingUrl: z.string().trim().url('Invalid tracking URL').or(z.string().trim().max(500)).optional().nullable(),
    estimatedDeliveryAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
    comment: z.string().trim().max(1000).optional().nullable(),
  }),
});

export const adminNotesSchema = z.object({
  body: z.object({
    notes: z.string().trim().min(1, 'Admin notes cannot be empty').max(2000),
  }),
});

export const processRefundSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive('Refund amount must be positive').optional(),
    reason: z.string().trim().min(3, 'Refund reason required').max(500),
  }),
});

export const adminReturnActionSchema = z.object({
  body: z.object({
    action: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().trim().max(500).optional().nullable(),
    restockItems: z.boolean().default(true),
  }),
});
