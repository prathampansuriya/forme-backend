import { z } from 'zod';

export const validateCouponSchema = z.object({
  body: z.object({
    code: z.string().trim().min(1, 'Coupon code is required'),
    items: z
      .array(
        z.object({
          variantId: z.string().uuid('Invalid variant ID format'),
          quantity: z.coerce.number().int().min(1).default(1),
        })
      )
      .default([]),
    stateCode: z.string().trim().max(4).optional().nullable(),
  }),
});

export const applicableCouponsSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          variantId: z.string().uuid('Invalid variant ID format'),
          quantity: z.coerce.number().int().min(1).default(1),
        })
      )
      .default([]),
  }),
});

export const createCouponSchema = z.object({
  body: z.object({
    code: z
      .string()
      .trim()
      .min(2, 'Coupon code must be at least 2 characters')
      .max(50, 'Coupon code cannot exceed 50 characters')
      .regex(/^[A-Z0-9_-]+$/i, 'Coupon code can only contain alphanumeric characters, underscores, and dashes'),
    description: z.string().trim().optional(),
    discountType: z.enum(['PERCENTAGE', 'FLAT'], {
      errorMap: () => ({ message: 'Discount type must be either PERCENTAGE or FLAT' }),
    }),
    discountValue: z.coerce.number().positive('Discount value must be greater than 0'),
    maxDiscountAmount: z.coerce.number().positive().optional().nullable(),
    minPurchaseAmount: z.coerce.number().min(0).optional().default(0),
    minOrderAmount: z.coerce.number().min(0).optional(),
    startDate: z.coerce.date().optional(),
    validFrom: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional().nullable(),
    usageLimit: z.coerce.number().int().min(0).default(0),
    perCustomerLimit: z.coerce.number().int().min(1).optional().default(1),
    perUserLimit: z.coerce.number().int().min(1).optional(),
    isActive: z.boolean().default(true),
    allowStacking: z.boolean().default(false),
    bannerUrl: z.string().url().optional().nullable(),
    productIds: z.array(z.string().uuid()).optional().default([]),
    categoryIds: z.array(z.string().uuid()).optional().default([]),
    collectionIds: z.array(z.string().uuid()).optional().default([]),
  }),
});

export const updateCouponSchema = z.object({
  body: z.object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[A-Z0-9_-]+$/i)
      .optional(),
    description: z.string().trim().optional(),
    discountType: z.enum(['PERCENTAGE', 'FLAT']).optional(),
    discountValue: z.coerce.number().positive().optional(),
    maxDiscountAmount: z.coerce.number().positive().optional().nullable(),
    minPurchaseAmount: z.coerce.number().min(0).optional(),
    minOrderAmount: z.coerce.number().min(0).optional(),
    startDate: z.coerce.date().optional(),
    validFrom: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional().nullable(),
    usageLimit: z.coerce.number().int().min(0).optional(),
    perCustomerLimit: z.coerce.number().int().min(1).optional(),
    perUserLimit: z.coerce.number().int().min(1).optional(),
    isActive: z.boolean().optional(),
    allowStacking: z.boolean().optional(),
    bannerUrl: z.string().url().optional().nullable(),
    productIds: z.array(z.string().uuid()).optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
    collectionIds: z.array(z.string().uuid()).optional(),
  }),
});

