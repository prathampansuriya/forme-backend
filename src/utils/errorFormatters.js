import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import ApplicationError from './ApplicationError.js';

export const formatZodError = (error) => {
  if (!(error instanceof ZodError)) return null;

  const errors = error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

  const mainMessage = errors.length > 0 ? errors[0].message : 'Validation failed for input data';

  return new ApplicationError(mainMessage, 400, 'VALIDATION_ERROR', errors);
};

export const formatPrismaError = (error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : error.meta?.target || 'field';
        return new ApplicationError(
          `A record with this ${target} already exists.`,
          409,
          'CONFLICT_RESOURCE',
          [{ field: target, message: `Unique constraint violated on ${target}` }]
        );
      }
      case 'P2025': {
        return new ApplicationError(
          'The requested record does not exist or has already been removed.',
          404,
          'RESOURCE_NOT_FOUND',
          []
        );
      }
      case 'P2003': {
        const field = error.meta?.field_name || 'relation';
        return new ApplicationError(
          'Referenced relationship was not found or is invalid.',
          400,
          'FOREIGN_KEY_VIOLATION',
          [{ field, message: 'Invalid relationship reference' }]
        );
      }
      case 'P2014': {
        return new ApplicationError(
          'Operation failed because a required relation would be violated.',
          400,
          'RELATION_VIOLATION',
          []
        );
      }
      default:
        return new ApplicationError(
          'A database error occurred while processing your request.',
          500,
          'DATABASE_ERROR',
          []
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ApplicationError(
      'Database query parameter validation failed.',
      400,
      'DATABASE_VALIDATION_ERROR',
      []
    );
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new ApplicationError(
      'Database connection could not be established. Please try again shortly.',
      503,
      'DATABASE_UNAVAILABLE',
      []
    );
  }

  return null;
};

export const formatExternalServiceError = (error, serviceName = 'External Service') => {
  // Never expose credentials, API keys, or raw provider bodies
  const sanitizedMessage = `${serviceName} encountered a temporary issue. Please try again.`;
  return new ApplicationError(sanitizedMessage, 502, 'EXTERNAL_SERVICE_ERROR', []);
};

export default {
  formatZodError,
  formatPrismaError,
  formatExternalServiceError,
};

