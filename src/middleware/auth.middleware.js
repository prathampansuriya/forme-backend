import jwt from 'jsonwebtoken';
import jwtConfig from '../config/jwt.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import prisma from '../config/prisma.config.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw ApplicationError.unauthorized('Authentication token is missing. Please sign in to continue.');
    }

    const decoded = jwt.verify(token, jwtConfig.accessSecret);

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isEmailVerified: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      throw ApplicationError.unauthorized('The account associated with this session no longer exists.');
    }

    if (user.status !== 'ACTIVE') {
      throw ApplicationError.forbidden('Your account is currently suspended. Please contact concierge@forme.store.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(ApplicationError.unauthorized('Invalid authentication token.'));
    } else if (error.name === 'TokenExpiredError') {
      next(new ApplicationError('Authentication session has expired. Please refresh your session.', 401, 'TOKEN_EXPIRED'));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, jwtConfig.accessSecret);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    if (user && user.status === 'ACTIVE') {
      req.user = user;
    } else {
      req.user = null;
    }

    next();
  } catch {
    // Silently continue for optional auth
    req.user = null;
    next();
  }
};

export default { authenticate, optionalAuth };

