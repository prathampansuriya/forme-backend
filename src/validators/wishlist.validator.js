import { z } from 'zod';

export const addToWishlistSchema = z.object({
  body: z.object({
    productId: z.string().uuid({ message: 'Valid product ID is required' }),
  }),
});

export const removeFromWishlistSchema = z.object({
  params: z.object({
    productId: z.string().uuid({ message: 'Valid product ID is required' }),
  }),
});

export const moveToCartSchema = z.object({
  body: z.object({
    productId: z.string().uuid({ message: 'Valid product ID is required' }),
    variantId: z.string().uuid({ message: 'Valid variant ID is required' }),
    quantity: z.number().int().min(1, { message: 'Quantity must be at least 1' }).default(1),
  }),
});

export default {
  addToWishlistSchema,
  removeFromWishlistSchema,
  moveToCartSchema,
};

