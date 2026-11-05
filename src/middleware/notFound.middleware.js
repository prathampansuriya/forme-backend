import ApplicationError from '../utils/ApplicationError.js';

export const notFoundHandler = (req, res, next) => {
  next(
    ApplicationError.notFound(
      `Route ${req.method} ${req.originalUrl} not found on FORME API server.`,
      'ROUTE_NOT_FOUND'
    )
  );
};

export default notFoundHandler;

