import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import env from './config/env.config.js';
import corsOptions from './config/cors.config.js';
import { requestLogger } from './config/logger.config.js';
import { generalLimiter } from './config/rateLimit.config.js';

import apiV1Router from './routes/index.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { globalErrorHandler } from './middleware/error.middleware.js';

const app = express();

// 1. Trust Reverse Proxy (when behind Nginx or Cloudflare)
app.set('trust proxy', 1);

// 2. HTTP Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com'],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://images.unsplash.com'],
        connectSrc: ["'self'", 'https://lumberjack.razorpay.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 3. Strict CORS Policy
app.use(cors(corsOptions));

// 4. Request Logging
app.use(requestLogger);

// 5. Global Rate Limiter
app.use('/api', generalLimiter);

// 6. Body Parsers with Strict Size Limits & Raw Body Preservation for Webhooks
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 7. Cookie Parser
app.use(cookieParser());

// 8. Top-Level Legacy Health Check (backward compatibility)
app.get('/api/health', (req, res) => {
  res.redirect('/api/v1/health');
});

// 9. Mount Centralized API v1 Routes
app.use('/api/v1', apiV1Router);

// 10. 404 Catch-All Route Handler
app.use(notFoundHandler);

// 11. Centralized Global Error Handler
app.use(globalErrorHandler);

export default app;
