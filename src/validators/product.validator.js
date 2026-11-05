import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(12),
    category: z.string().optional(),
    collection: z.string().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    size: z.string().optional(), // Can be comma-separated: 'S,M,L' or single
    color: z.string().optional(), // Can be comma-separated: 'Black,Ecru'
    audience: z.enum(['WOMEN', 'MEN', 'UNISEX']).optional(),
    productType: z.string().optional(),
    fabric: z.string().optional(),
    fit: z.string().optional(),
    inStock: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    hasDiscount: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    isNewArrival: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    isFeatured: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    minRating: z.coerce.number().min(1).max(5).optional(),
    status: z.string().optional(),
    includeAllStatus: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    includeArchived: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    sort: z
      .enum([
        'price_asc',
        'price_desc',
        'newest',
        'created_desc',
        'best_sellers',
        'popularity',
        'trending',
        'rating_desc',
        'featured',
      ])
      .default('newest'),
    search: z.string().optional(),
  }),
});

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Product name must be at least 2 characters').trim(),
    slug: z
      .string()
      .min(2)
      .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, numbers, and hyphens')
      .trim(),
    baseSku: z.string().min(2, 'Base SKU is required').toUpperCase().trim(),
    shortDescription: z.string().optional(),
    longDescription: z.string().optional(),
    categoryId: z.string().uuid('Valid Category ID is required'),
    collectionIds: z.array(z.string().uuid()).optional(),
    audience: z.enum(['WOMEN', 'MEN', 'UNISEX']).default('WOMEN'),
    productType: z.string().min(2, 'Product type is required (e.g., Trench Coat, Blazer)'),
    fabric: z.string().optional(),
    fit: z.string().optional(),
    material: z.string().optional(),
    careInstructions: z.string().optional(),
    specifications: z.record(z.any()).optional(),
    tags: z.array(z.string()).default([]),
    sellingPrice: z.coerce.number().positive('Selling price must be greater than zero'),
    compareAtPrice: z.coerce.number().positive().optional().nullable(),
    taxClassificationId: z.string().optional().nullable(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
    isFeatured: z.boolean().default(false),
    isNewArrival: z.boolean().default(false),
    seoTitle: z.string().optional().nullable(),
    seoDescription: z.string().optional().nullable(),
    seoKeywords: z.array(z.string()).default([]),
    variants: z
      .array(
        z.object({
          sku: z.string().min(2).toUpperCase().trim(),
          size: z.string().min(1, 'Size is required'),
          colorName: z.string().min(1, 'Color name is required'),
          colorHex: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Valid hex color required'),
          priceOverride: z.coerce.number().positive().optional().nullable(),
          compareAtPriceOverride: z.coerce.number().positive().optional().nullable(),
          stockQuantity: z.coerce.number().int().nonnegative().default(0),
          weight: z.coerce.number().positive().optional().nullable(),
        })
      )
      .optional(),
    media: z
      .array(
        z.object({
          mediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
          publicId: z.string().min(1, 'Cloudinary public ID is required'),
          secureUrl: z.string().url('Secure delivery URL is required'),
          thumbnailUrl: z.string().url().optional().nullable(),
          altText: z.string().optional().nullable(),
          displayOrder: z.coerce.number().int().default(0),
          isPrimary: z.boolean().default(false),
          variantId: z.string().uuid().optional().nullable(),
          colorName: z.string().optional().nullable(), // For bulk color gallery mapping
        })
      )
      .optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).trim().optional(),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/).trim().optional(),
    baseSku: z.string().min(2).toUpperCase().trim().optional(),
    shortDescription: z.string().optional().nullable(),
    longDescription: z.string().optional().nullable(),
    categoryId: z.string().uuid().optional(),
    collectionIds: z.array(z.string().uuid()).optional(),
    audience: z.enum(['WOMEN', 'MEN', 'UNISEX']).optional(),
    productType: z.string().min(2).optional(),
    fabric: z.string().optional().nullable(),
    fit: z.string().optional().nullable(),
    material: z.string().optional().nullable(),
    careInstructions: z.string().optional().nullable(),
    specifications: z.record(z.any()).optional().nullable(),
    tags: z.array(z.string()).optional(),
    sellingPrice: z.coerce.number().positive().optional(),
    compareAtPrice: z.coerce.number().positive().optional().nullable(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    isFeatured: z.boolean().optional(),
    isNewArrival: z.boolean().optional(),
    seoTitle: z.string().optional().nullable(),
    seoDescription: z.string().optional().nullable(),
    seoKeywords: z.array(z.string()).optional(),
  }),
});

export const createVariantSchema = z.object({
  body: z.object({
    sku: z.string().min(2, 'SKU is required').toUpperCase().trim(),
    size: z.string().min(1, 'Size is required (e.g. XS, S, M, 38, 40)'),
    colorName: z.string().min(1, 'Color name is required (e.g. Midnight Espresso)'),
    colorHex: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Valid hex color code required'),
    priceOverride: z.coerce.number().positive().optional().nullable(),
    compareAtPriceOverride: z.coerce.number().positive().optional().nullable(),
    stockQuantity: z.coerce.number().int().nonnegative().default(0),
    weight: z.coerce.number().positive().optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).default('ACTIVE'),
  }),
});

export const updateVariantSchema = z.object({
  body: z.object({
    sku: z.string().min(2).toUpperCase().trim().optional(),
    size: z.string().min(1).optional(),
    colorName: z.string().min(1).optional(),
    colorHex: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).optional(),
    priceOverride: z.coerce.number().positive().optional().nullable(),
    compareAtPriceOverride: z.coerce.number().positive().optional().nullable(),
    stockQuantity: z.coerce.number().int().nonnegative().optional(),
    availableQuantity: z.coerce.number().int().nonnegative().optional(),
    weight: z.coerce.number().positive().optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
  }),
});

export const createMediaSchema = z.object({
  body: z.object({
    mediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
    publicId: z.string().min(1, 'Cloudinary public ID is required'),
    secureUrl: z.string().url('Cloudinary secure URL is required'),
    thumbnailUrl: z.string().url().optional().nullable(),
    altText: z.string().optional().nullable(),
    displayOrder: z.coerce.number().int().default(0),
    isPrimary: z.boolean().default(false),
    variantId: z.string().uuid().optional().nullable(),
    metadata: z.record(z.any()).optional().nullable(),
  }),
});

export const updateMediaSchema = z.object({
  body: z.object({
    altText: z.string().optional().nullable(),
    displayOrder: z.coerce.number().int().optional(),
    isPrimary: z.boolean().optional(),
    variantId: z.string().uuid().optional().nullable(),
    thumbnailUrl: z.string().url().optional().nullable(),
  }),
});

export default {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  createMediaSchema,
  updateMediaSchema,
};
