import { z } from 'zod';

export const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search term cannot be empty').max(100).trim(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(12),
    category: z.string().optional(),
    collection: z.string().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    sort: z
      .enum(['relevance', 'price_asc', 'price_desc', 'newest', 'best_sellers', 'trending'])
      .default('relevance'),
  }),
});

export const autocompleteQuerySchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required').max(100).trim(),
  }),
});

export default {
  searchQuerySchema,
  autocompleteQuerySchema,
};

