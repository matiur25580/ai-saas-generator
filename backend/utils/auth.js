import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError, asyncHandler } from './http.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.split(' ') || [];
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Authentication is required.', 'AUTH_REQUIRED');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new ApiError(401, 'Your session has expired. Please log in again.', 'AUTH_INVALID');
  }
  if (decoded.type !== 'access' || typeof decoded.id !== 'string') {
    throw new ApiError(401, 'Your session has expired. Please log in again.', 'AUTH_INVALID');
  }

  const user = await User.findById(decoded.id).select('_id role tokenVersion isActive');
  if (!user || !user.isActive || Number(decoded.ver ?? 0) !== user.tokenVersion) {
    throw new ApiError(401, 'Your session has been revoked. Please log in again.', 'AUTH_REVOKED');
  }
  req.userId = user._id.toString();
  req.userRole = user.role;
  next();
});

export function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return requireAuth(req, res, next);
}

export const requireAdmin = [
  requireAuth,
  (req, res, next) => {
    if (String(req.userRole || '').toLowerCase() !== 'admin') {
      return next(new ApiError(403, 'Administrator access is required.', 'ADMIN_REQUIRED'));
    }
    next();
  }
];
