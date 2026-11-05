import { z } from 'zod';

export const createAddressSchema = z.object({
  body: z.object({
    recipientName: z.string().min(2, { message: 'Recipient name must be at least 2 characters' }).max(100),
    phone: z.string().min(8, { message: 'Valid phone number is required' }).max(20),
    addressLine1: z.string().min(5, { message: 'Address line 1 is required' }).max(255),
    addressLine2: z.string().max(255).optional().nullable(),
    landmark: z.string().max(150).optional().nullable(),
    city: z.string().min(2, { message: 'City is required' }).max(100),
    state: z.string().min(2, { message: 'State is required' }).max(100),
    postalCode: z.string().min(4, { message: 'Postal code is required' }).max(20),
    country: z.string().default('India'),
    addressType: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
    isDefaultShipping: z.boolean().default(false),
    isDefaultBilling: z.boolean().default(false),
  }),
});

export const updateAddressSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid address ID is required' }),
  }),
  body: z.object({
    recipientName: z.string().min(2).max(100).optional(),
    phone: z.string().min(8).max(20).optional(),
    addressLine1: z.string().min(5).max(255).optional(),
    addressLine2: z.string().max(255).optional().nullable(),
    landmark: z.string().max(150).optional().nullable(),
    city: z.string().min(2).max(100).optional(),
    state: z.string().min(2).max(100).optional(),
    postalCode: z.string().min(4).max(20).optional(),
    country: z.string().optional(),
    addressType: z.enum(['HOME', 'WORK', 'OTHER']).optional(),
    isDefaultShipping: z.boolean().optional(),
    isDefaultBilling: z.boolean().optional(),
  }),
});

export const setDefaultAddressSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid address ID is required' }),
  }),
  body: z.object({
    type: z.enum(['SHIPPING', 'BILLING', 'BOTH']).default('SHIPPING'),
  }),
});

export const addressIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid address ID is required' }),
  }),
});

export default {
  createAddressSchema,
  updateAddressSchema,
  setDefaultAddressSchema,
  addressIdParamSchema,
};

