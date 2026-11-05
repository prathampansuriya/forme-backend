import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters').trim(),
    slug: z
      .string()
      .min(2)
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .trim(),
    description: z.string().optional().nullable(),
    thumbnailUrl: z.string().url().optional().nullable(),
    bannerUrl: z.string().url().optional().nullable(),
    seoTitle: z.string().optional().nullable(),
    seoDescription: z.string().optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
    displayOrder: z.coerce.number().int().default(0),
    parentId: z.string().uuid().optional().nullable(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).trim().optional(),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/).trim().optional(),
    description: z.string().optional().nullable(),
    thumbnailUrl: z.string().url().optional().nullable(),
    bannerUrl: z.string().url().optional().nullable(),
    seoTitle: z.string().optional().nullable(),
    seoDescription: z.string().optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
    displayOrder: z.coerce.number().int().optional(),
    parentId: z.string().uuid().optional().nullable(),
  }),
});

export default {
  createCategorySchema,
  updateCategorySchema,
};

