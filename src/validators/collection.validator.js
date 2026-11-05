import { z } from 'zod';

export const createCollectionSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Collection name must be at least 2 characters').trim(),
    slug: z
      .string()
      .min(2)
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .trim(),
    description: z.string().optional().nullable(),
    desktopBannerUrl: z.string().url().optional().nullable(),
    mobileBannerUrl: z.string().url().optional().nullable(),
    thumbnailUrl: z.string().url().optional().nullable(),
    desktopMediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
    mobileMediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
    seoTitle: z.string().optional().nullable(),
    seoDescription: z.string().optional().nullable(),
    isPublished: z.boolean().default(false),
    scheduleStart: z.coerce.date().optional().nullable(),
    scheduleEnd: z.coerce.date().optional().nullable(),
    displayOrder: z.coerce.number().int().default(0),
  }),
});

export const updateCollectionSchema = z.object({
  body: z.object({
    name: z.string().min(2).trim().optional(),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/).trim().optional(),
    description: z.string().optional().nullable(),
    desktopBannerUrl: z.string().url().optional().nullable(),
    mobileBannerUrl: z.string().url().optional().nullable(),
    thumbnailUrl: z.string().url().optional().nullable(),
    desktopMediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
    mobileMediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
    seoTitle: z.string().optional().nullable(),
    seoDescription: z.string().optional().nullable(),
    isPublished: z.boolean().optional(),
    scheduleStart: z.coerce.date().optional().nullable(),
    scheduleEnd: z.coerce.date().optional().nullable(),
    displayOrder: z.coerce.number().int().optional(),
  }),
});

export const addCollectionProductsSchema = z.object({
  body: z.object({
    productIds: z.array(z.string().uuid()).min(1, 'At least one Product ID is required'),
  }),
});

export default {
  createCollectionSchema,
  updateCollectionSchema,
  addCollectionProductsSchema,
};

