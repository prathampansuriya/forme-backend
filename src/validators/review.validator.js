import { z } from 'zod';

const reviewMediaSchema = z.object({
  url: z.string().url({ message: 'Valid media URL is required' }),
  publicId: z.string().min(1, { message: 'Cloudinary public ID is required' }),
  mediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
  displayOrder: z.number().int().min(0).default(0),
});

export const createReviewSchema = z.object({
  body: z.object({
    productId: z.string().uuid({ message: 'Valid product ID is required' }),
    rating: z.number().int().min(1, { message: 'Rating must be at least 1 star' }).max(5, { message: 'Rating cannot exceed 5 stars' }),
    headline: z.string().max(150, { message: 'Headline must not exceed 150 characters' }).optional().nullable(),
    content: z.string().min(5, { message: 'Review content must be at least 5 characters' }).max(2000),
    media: z.array(reviewMediaSchema).optional().default([]),
    verifiedOnly: z.boolean().optional().default(false),
  }),
});

export const updateReviewSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid review ID is required' }),
  }),
  body: z.object({
    rating: z.number().int().min(1).max(5).optional(),
    headline: z.string().max(150).optional().nullable(),
    content: z.string().min(5).max(2000).optional(),
    media: z.array(reviewMediaSchema).optional(),
  }),
});

export const reviewIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid review ID is required' }),
  }),
});

export const productIdParamSchema = z.object({
  params: z.object({
    productId: z.string().uuid({ message: 'Valid product ID is required' }),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sort: z.enum(['recent', 'highest', 'lowest']).default('recent'),
  }).optional(),
});

export const moderateReviewSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid review ID is required' }),
  }),
  body: z.object({
    isApproved: z.boolean({ required_error: 'Approval status boolean is required' }),
  }),
});

export default {
  createReviewSchema,
  updateReviewSchema,
  reviewIdParamSchema,
  productIdParamSchema,
  moderateReviewSchema,
};

