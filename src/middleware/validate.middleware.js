import { ZodError } from 'zod';
import { formatZodError } from '../utils/errorFormatters.js';

export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Assign sanitized and parsed values back to request
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      next(formatZodError(error));
    } else {
      next(error);
    }
  }
};

export default validate;

