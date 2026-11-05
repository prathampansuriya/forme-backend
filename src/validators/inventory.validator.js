import { z } from 'zod';

export const reserveStockSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          variantId: z.string().uuid({ message: 'Valid variant ID is required' }),
          quantity: z.number().int().min(1, { message: 'Quantity must be at least 1' }),
        })
      )
      .min(1, { message: 'At least one item is required for reservation' }),
    cartId: z.string().uuid().optional().nullable(),
    checkoutSessionId: z.string().min(1).optional().nullable(),
    ttlMinutes: z.number().int().min(1).max(60).default(15),
  }),
});

export const releaseStockSchema = z.object({
  body: z.object({
    reservationIds: z.array(z.string().uuid()).optional(),
    checkoutSessionId: z.string().optional().nullable(),
    cartId: z.string().uuid().optional().nullable(),
  }),
});

export const adjustStockSchema = z.object({
  body: z.object({
    variantId: z.string().uuid({ message: 'Valid variant ID is required' }),
    newStockQuantity: z.number().int().min(0, { message: 'New physical stock cannot be negative' }),
    reason: z.string().min(3, { message: 'Audit reason is required' }).max(255),
    locationId: z.string().uuid().optional().nullable(),
  }),
});

export const replenishStockSchema = z.object({
  body: z.object({
    variantId: z.string().uuid({ message: 'Valid variant ID is required' }),
    quantity: z.number().int().min(1, { message: 'Replenishment quantity must be at least 1' }),
    reason: z.string().min(3).max(255).default('Manual warehouse replenishment'),
    costPerUnit: z.number().positive().optional().nullable(),
    locationId: z.string().uuid().optional().nullable(),
  }),
});

export const reduceStockSchema = z.object({
  body: z.object({
    variantId: z.string().uuid({ message: 'Valid variant ID is required' }),
    quantity: z.number().int().min(1, { message: 'Reduction quantity must be at least 1' }),
    reason: z.string().min(3, { message: 'Write-off reason is required' }).max(255),
    locationId: z.string().uuid().optional().nullable(),
  }),
});

export const queryInventorySchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
      lowStockOnly: z
        .preprocess((val) => (val === 'true' || val === true ? true : false), z.boolean())
        .optional(),
      threshold: z.coerce.number().int().min(1).default(5),
    })
    .optional(),
});

export const queryReservationsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(['ACTIVE', 'COMMITTED', 'EXPIRED', 'RELEASED']).optional(),
      variantId: z.string().uuid().optional(),
      cartId: z.string().uuid().optional(),
      orderId: z.string().uuid().optional(),
    })
    .optional(),
});

export const restockReturnSchema = z.object({
  body: z.object({
    orderId: z.string().uuid({ message: 'Valid order ID is required' }),
    variantId: z.string().uuid({ message: 'Valid variant ID is required' }),
    quantity: z.number().int().min(1).default(1),
    reason: z.string().min(3).max(255).default('Customer garment return inspected and approved'),
  }),
});

export default {
  reserveStockSchema,
  releaseStockSchema,
  adjustStockSchema,
  replenishStockSchema,
  reduceStockSchema,
  queryInventorySchema,
  queryReservationsSchema,
  restockReturnSchema,
};

