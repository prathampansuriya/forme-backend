import { z } from 'zod';

export const createOfferSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
    title: z.string().trim().min(2, 'Title must be at least 2 characters').optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
    description: z.string().trim().optional(),
    discountType: z.enum(['PERCENTAGE', 'FLAT']),
    discountValue: z.coerce.number().positive(),
    maxDiscountAmount: z.coerce.number().positive().optional().nullable(),
    maxDiscount: z.coerce.number().positive().optional().nullable(),
    minPurchaseAmount: z.coerce.number().min(0).default(0),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
    allowStacking: z.boolean().default(false),
    isStackable: z.boolean().optional(),
    bannerUrl: z.string().url().optional().nullable().or(z.literal('')),
    productIds: z.array(z.string().uuid()).optional().default([]),
    categoryIds: z.array(z.string().uuid()).optional().default([]),
    collectionIds: z.array(z.string().uuid()).optional().default([]),
  }),
});

export const updateOfferSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).optional(),
    title: z.string().trim().min(2).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    description: z.string().trim().optional(),
    discountType: z.enum(['PERCENTAGE', 'FLAT']).optional(),
    discountValue: z.coerce.number().positive().optional(),
    maxDiscountAmount: z.coerce.number().positive().optional().nullable(),
    maxDiscount: z.coerce.number().positive().optional().nullable(),
    minPurchaseAmount: z.coerce.number().min(0).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
    allowStacking: z.boolean().optional(),
    isStackable: z.boolean().optional(),
    bannerUrl: z.string().url().optional().nullable().or(z.literal('')),
    productIds: z.array(z.string().uuid()).optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
    collectionIds: z.array(z.string().uuid()).optional(),
  }),
});

