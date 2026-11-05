import { z } from 'zod';

export const calculatePricingSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          variantId: z.string().uuid('Invalid variant ID format'),
          quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
        })
      )
      .min(1, 'Cart items array cannot be empty'),
    couponCode: z.string().trim().optional().nullable(),
    stateCode: z.string().trim().max(4).optional().nullable(),
    shippingAddress: z
      .object({
        state: z.string().optional(),
        city: z.string().optional(),
        pincode: z.string().optional(),
      })
      .optional()
      .nullable(),
  }),
});

