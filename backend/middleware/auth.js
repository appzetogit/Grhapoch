import jwtService from '../services/jwtService.js';
import User from '../models/User.js';
import { errorResponse } from '../utils/response.js';

/**
 * Authentication Middleware
 * Verifies JWT access token and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwtService.verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return errorResponse(res, 401, 'User not found');
    }

    if (!user.isActive) {
      return errorResponse(res, 401, 'User account is inactive');
    }

    // Attach user to request
    req.user = user;
    req.token = decoded;

    next();
  } catch (error) {
    return errorResponse(res, 401, error.message || 'Invalid token');
  }
};

/**
 * Optional Authentication Middleware
 * If token is present and valid, attaches user. Otherwise continues without failing.
 * Useful for public endpoints that can benefit from user context (e.g., pricing with user-scoped coupons).
 */
export const authenticateOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwtService.verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user || !user.isActive) {
      return next();
    }

    req.user = user;
    req.token = decoded;
    return next();
  } catch (error) {
    // Silently ignore token errors for optional auth
    return next();
  }
};

/**
 * Role-based Authorization Middleware
 * @param {...string} roles - Allowed roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }

    next();
  };
};

export default { authenticate, authenticateOptional, authorize };

