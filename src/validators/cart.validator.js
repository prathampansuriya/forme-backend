import { z } from 'zod';

export const addToCartSchema = z.object({
  body: z.object({
    variantId: z.string().uuid({ message: 'Valid variant ID is required' }),
    quantity: z.number().int().min(1, { message: 'Quantity must be at least 1' }).default(1),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid({ message: 'Valid cart item ID is required' }),
  }),
  body: z.object({
    quantity: z.number().int().min(0, { message: 'Quantity must be 0 or greater' }),
  }),
});

export const removeCartItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid({ message: 'Valid cart item ID is required' }),
  }),
});

export const applyCouponSchema = z.object({
  body: z
    .object({
      couponCode: z.string().min(2, { message: 'Coupon code is required' }).max(50).optional(),
      code: z.string().min(2, { message: 'Coupon code is required' }).max(50).optional(),
    })
    .refine((data) => Boolean(data.couponCode || data.code), {
      message: 'Coupon code is required',
      path: ['couponCode'],
    }),
});

export const mergeCartSchema = z.object({
  body: z.object({
    guestSessionId: z.string().min(1, { message: 'Guest session ID is required' }),
  }),
});

export default {
  addToCartSchema,
  updateCartItemSchema,
  removeCartItemSchema,
  applyCouponSchema,
  mergeCartSchema,
};

