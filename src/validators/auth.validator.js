import { z } from 'zod';
import { emailSchema, passwordSchema, phoneSchema } from './common.validator.js';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, { message: 'Name must contain at least 2 characters' }).max(100),
    email: emailSchema,
    password: passwordSchema,
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: z.string().trim().regex(/^\d{6}$/, { message: 'Verification code must be exactly 6 digits' }),
  }),
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
    purpose: z.enum(['REGISTRATION', 'LOGIN', 'PASSWORD_RESET']).default('REGISTRATION'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, { message: 'Password is required' }),
  }),
});

export const adminLoginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, { message: 'Password is required' }),
  }),
});

export const googleLoginSchema = z.object({
  body: z.object({
    credential: z.string().min(10, { message: 'Google credential token is required' }),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
    token: z.string().min(10, { message: 'Password reset token is required' }),
    newPassword: passwordSchema,
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, { message: 'Current password is required' }),
    newPassword: passwordSchema,
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: phoneSchema.optional().nullable(),
    avatarUrl: z.string().url().optional().nullable().or(z.literal('')),
  }),
});

export default {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  adminLoginSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
};

