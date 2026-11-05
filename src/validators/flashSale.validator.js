import { z } from 'zod';

export const createFlashSaleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    slug: z
      .string()
      .trim()
      .min(2)
      .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
    description: z.string().trim().optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    priority: z.coerce.number().int().default(0),
    products: z
      .array(
        z.object({
          productId: z.string().uuid(),
          variantId: z.string().uuid().optional().nullable(),
          discountType: z.enum(['PERCENTAGE', 'FLAT']).default('PERCENTAGE'),
          discountValue: z.coerce.number().positive(),
          stockLimit: z.coerce.number().int().min(0).default(0),
        })
      )
      .optional()
      .default([]),
  }),
});

export const updateFlashSaleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    description: z.string().trim().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    priority: z.coerce.number().int().optional(),
    status: z.enum(['UPCOMING', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  }),
});

export const addFlashSaleProductsSchema = z.object({
  body: z.object({
    products: z
      .array(
        z.object({
          productId: z.string().uuid(),
          variantId: z.string().uuid().optional().nullable(),
          discountType: z.enum(['PERCENTAGE', 'FLAT']).default('PERCENTAGE'),
          discountValue: z.coerce.number().positive(),
          stockLimit: z.coerce.number().int().min(0).default(0),
        })
      )
      .min(1, 'Products array cannot be empty'),
  }),
});

