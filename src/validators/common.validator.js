import { z } from 'zod';

export const uuidSchema = z.string().uuid({ message: 'Invalid unique identifier format' });

export const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
});

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Please provide a valid email address' });

export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must contain at least 8 characters' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number' });

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, { message: 'Please provide a valid international phone number' });

export default {
  uuidSchema,
  paginationSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
};

