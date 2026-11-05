import ApplicationError from '../utils/ApplicationError.js';

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApplicationError.unauthorized('Authentication required to access this resource.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApplicationError.forbidden(
          'You do not possess the required administrative privileges to perform this action.'
        )
      );
    }

    next();
  };
};

export const requireAdmin = authorizeRoles('ADMIN');
export const requireCustomer = authorizeRoles('CUSTOMER', 'ADMIN');

export default { authorizeRoles, requireAdmin, requireCustomer };

