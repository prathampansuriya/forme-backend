import { z } from 'zod';

export const trackViewSchema = z.object({
  body: z.object({
    productId: z.string().uuid({ message: 'Valid product ID is required' }),
    sessionId: z.string().optional().nullable(),
  }),
});

export const trackSearchSchema = z.object({
  body: z.object({
    query: z.string().min(1, { message: 'Search query is required' }).max(200),
    resultsCount: z.number().int().min(0).default(0),
  }),
});

export default {
  trackViewSchema,
  trackSearchSchema,
};

