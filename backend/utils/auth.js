import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError, asyncHandler } from './http.js';

export function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.split(' ') || [];
  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Authentication is required.', 'AUTH_REQUIRED'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'access') throw new Error('Invalid token type');
    req.userId = decoded.id;
    next();
  } catch {
    next(new ApiError(401, 'Your session has expired. Please log in again.', 'AUTH_INVALID'));
  }
}

export function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  requireAuth(req, res, next);
}

export const requireAdmin = [
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.userId).select('role');
    if (String(user?.role || '').toLowerCase() !== 'admin') {
      throw new ApiError(403, 'Administrator access is required.', 'ADMIN_REQUIRED');
    }
    next();
  })
];