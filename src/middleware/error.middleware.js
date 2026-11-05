import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import ApplicationError from '../utils/ApplicationError.js';
import { formatZodError, formatPrismaError } from '../utils/errorFormatters.js';
import env from '../config/env.config.js';

export const globalErrorHandler = (err, req, res, next) => {
  let error = err;

  // 1. Convert ZodError to ApplicationError
  if (err instanceof ZodError) {
    error = formatZodError(err);
  }

  // 2. Convert Prisma Error to ApplicationError
  else if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientInitializationError
  ) {
    error = formatPrismaError(err);
  }

  // 3. Handle Malformed JSON Payload (SyntaxError from body-parser)
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new ApplicationError('Malformed JSON payload provided in request body.', 400, 'MALFORMED_JSON', []);
  }

  // 4. Handle JWT Verification Errors
  else if (err.name === 'JsonWebTokenError') {
    error = new ApplicationError('Invalid authentication token.', 401, 'INVALID_TOKEN', []);
  } else if (err.name === 'TokenExpiredError') {
    error = new ApplicationError('Authentication session has expired. Please refresh your session.', 401, 'TOKEN_EXPIRED', []);
  }

  // 5. Default Fallback to ApplicationError if not already one
  if (!(error instanceof ApplicationError)) {
    const message = env.NODE_ENV === 'production' ? 'An internal server error occurred.' : err.message || 'Internal server error';
    error = new ApplicationError(message, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', []);
  }

  // Log server errors for internal monitoring (5xx)
  if (error.statusCode >= 500) {
    console.error(`❌ [SERVER ERROR ${error.statusCode}] [${error.code}] ${req.method} ${req.originalUrl}:`, err.stack || err);
  } else if (env.NODE_ENV === 'development') {
    console.warn(`⚠️ [CLIENT ERROR ${error.statusCode}] [${error.code}] ${req.method} ${req.originalUrl}: ${error.message}`);
  }

  // Mask sensitive response details
  const responsePayload = {
    success: false,
    message: error.message,
    errors: error.errors || [],
    code: error.code || 'ERROR',
  };

  return res.status(error.statusCode).json(responsePayload);
};

export default globalErrorHandler;

