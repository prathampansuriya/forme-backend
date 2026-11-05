import { z } from 'zod';

export const queryCustomersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
    role: z.enum(['CUSTOMER', 'ADMIN']).optional(),
    isEmailVerified: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['createdAt', 'name', 'email', 'lastLoginAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const updateCustomerStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid customer ID required'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
    reason: z.string().trim().max(500).optional().nullable(),
  }),
});

export const customerIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid customer ID required'),
  }),
});

export const analyticsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    days: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

export const queryAuditLogsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    adminUserId: z.string().uuid().optional(),
    entityType: z.string().trim().optional(),
    action: z.string().trim().optional(),
    startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
});

export const storeSettingSchema = z.object({
  body: z.object({
    key: z.string().trim().min(1, 'Setting key is required'),
    value: z.any(),
    description: z.string().trim().optional().nullable(),
  }),
});

export const taxSettingSchema = z.object({
  body: z.object({
    stateCode: z.string().trim().min(2).max(10).toUpperCase(),
    stateName: z.string().trim().min(2),
    cgstRate: z.number().min(0).max(100).default(6.0),
    sgstRate: z.number().min(0).max(100).default(6.0),
    igstRate: z.number().min(0).max(100).default(12.0),
    isActive: z.boolean().default(true),
  }),
});

export const updateTaxSettingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid tax setting ID required'),
  }),
  body: z.object({
    stateCode: z.string().trim().min(2).max(10).toUpperCase().optional(),
    stateName: z.string().trim().min(2).optional(),
    cgstRate: z.number().min(0).max(100).optional(),
    sgstRate: z.number().min(0).max(100).optional(),
    igstRate: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const shippingSettingSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Shipping method name is required'),
    minOrderAmount: z.number().min(0).default(0),
    rate: z.number().min(0).default(250.0),
    isFreeShipping: z.boolean().default(false),
    estimatedDays: z.number().int().min(1).max(30).default(3),
    isActive: z.boolean().default(true),
  }),
});

export const updateShippingSettingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid shipping setting ID required'),
  }),
  body: z.object({
    name: z.string().trim().min(2).optional(),
    minOrderAmount: z.number().min(0).optional(),
    rate: z.number().min(0).optional(),
    isFreeShipping: z.boolean().optional(),
    estimatedDays: z.number().int().min(1).max(30).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const currencySettingSchema = z.object({
  body: z.object({
    code: z.string().trim().min(2).max(5).toUpperCase(),
    symbol: z.string().trim().min(1).max(5),
    exchangeRate: z.number().positive('Exchange rate must be greater than zero'),
    isDefault: z.boolean().default(false),
    decimalPlaces: z.number().int().min(0).max(4).default(2),
  }),
});

export const updateCurrencySettingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid currency ID required'),
  }),
  body: z.object({
    symbol: z.string().trim().min(1).max(5).optional(),
    exchangeRate: z.number().positive().optional(),
    isDefault: z.boolean().optional(),
    decimalPlaces: z.number().int().min(0).max(4).optional(),
  }),
});

export const brandSettingSchema = z.object({
  body: z.object({
    brandName: z.string().trim().min(1).optional(),
    tagline: z.string().trim().optional().nullable(),
    logoUrl: z.string().trim().optional(),
    faviconUrl: z.string().trim().optional(),
    supportEmail: z.string().email('Valid support email required').optional(),
    supportPhone: z.string().trim().optional().nullable(),
    socialLinks: z.record(z.any()).optional().nullable(),
  }),
});

export const queryPaymentsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
    method: z.enum(['RAZORPAY_UPI', 'RAZORPAY_CARD', 'RAZORPAY_NETBANKING', 'COD']).optional(),
    search: z.string().trim().optional(),
    startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
});

export const moderateReviewAdminSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid review ID required'),
  }),
  body: z.object({
    isApproved: z.boolean(),
  }),
});

