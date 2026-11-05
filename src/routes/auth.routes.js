import { Router } from 'express';
import {
  register,
  verifyOTP,
  resendOTP,
  login,
  adminLogin,
  googleLogin,
  refreshToken,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  changePassword,
  getCurrentUser,
  updateProfile,
  uploadAvatar,
} from '../controllers/auth.controller.js';

import { validate } from '../middleware/validate.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadMediaMiddleware } from '../middleware/upload.middleware.js';
import {
  loginLimiter,
  otpLimiter,
  passwordResetLimiter,
} from '../config/rateLimit.config.js';

import {
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
} from '../validators/auth.validator.js';

const router = Router();

// Public Authentication Endpoints
router.post('/register', validate(registerSchema), register);
router.post('/verify-otp', otpLimiter, validate(verifyOtpSchema), verifyOTP);
router.post('/resend-otp', otpLimiter, validate(resendOtpSchema), resendOTP);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/admin/login', loginLimiter, validate(adminLoginSchema), adminLogin);
router.post('/google', loginLimiter, validate(googleLoginSchema), googleLogin);
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Authenticated Endpoints
router.get('/me', authenticate, getCurrentUser);
router.patch('/profile', authenticate, validate(updateProfileSchema), updateProfile);
router.post(
  '/avatar',
  authenticate,
  uploadMediaMiddleware.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  uploadAvatar
);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);
router.post('/logout-all', authenticate, logoutAll);

export default router;

