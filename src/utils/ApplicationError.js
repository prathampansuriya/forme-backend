export class ApplicationError extends Error {
  constructor(message = 'An unexpected error occurred', statusCode = 500, code = 'INTERNAL_SERVER_ERROR', errors = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.errors = Array.isArray(errors) ? errors : [errors];
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', errors = [], code = 'BAD_REQUEST') {
    if (typeof errors === 'string') {
      return new ApplicationError(message, 400, errors, []);
    }
    return new ApplicationError(message, 400, code, errors);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    return new ApplicationError(message, 401, code, []);
  }

  static forbidden(message = 'Access forbidden', code = 'FORBIDDEN_RESOURCE') {
    return new ApplicationError(message, 403, code, []);
  }

  static notFound(message = 'Requested resource not found', code = 'RESOURCE_NOT_FOUND') {
    return new ApplicationError(message, 404, code, []);
  }

  static conflict(message = 'Conflict with existing resource', code = 'CONFLICT_RESOURCE') {
    return new ApplicationError(message, 409, code, []);
  }

  static unprocessable(message = 'Unprocessable Entity', errors = [], code = 'VALIDATION_ERROR') {
    return new ApplicationError(message, 422, code, errors);
  }

  static tooManyRequests(message = 'Rate limit exceeded', code = 'RATE_LIMIT_EXCEEDED') {
    return new ApplicationError(message, 429, code, []);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_SERVER_ERROR') {
    return new ApplicationError(message, 500, code, []);
  }
}

export default ApplicationError;

