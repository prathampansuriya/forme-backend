import rateLimit from 'express-rate-limit';

const createLimiter = ({
  windowMs,
  max,
  message,
  statusCode = 429,
  skipSuccessfulRequests = false,
}) => {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      res.status(statusCode).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: message || 'Too many requests. Please try again later.',
        errors: [],
      });
    },
  });
};

// General API rate limiter (1200 requests per 15 minutes)
export const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  message: 'Too many requests from this IP. Please try again later.',
});

// Authentication rate limiter (10 failed attempts per 15 minutes)
export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts. Please try again later.',
});

// OTP request limiter (5 requests per 15 minutes)
export const otpLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many OTP requests. Please wait before requesting a new code.',
});

// Password reset request limiter (5 requests per hour)
export const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please wait before trying again.',
});

// Catalog Search limiter (120 requests per minute)
export const searchLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many search requests. Please slow down your search queries.',
});

// Checkout & Order creation limiter (20 requests per 15 minutes)
export const checkoutLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many checkout attempts. Please try again later.',
});

export default {
  generalLimiter,
  loginLimiter,
  otpLimiter,
  passwordResetLimiter,
  searchLimiter,
  checkoutLimiter,
};