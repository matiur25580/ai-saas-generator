import { validationResult } from 'express-validator';

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(400, errors.array()[0].msg, 'VALIDATION_ERROR'));
  }
  next();
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = status >= 500 && code === 'INTERNAL_ERROR'
    ? 'An unexpected error occurred. Please try again later.'
    : error.message;
  console.error(JSON.stringify({
    level: 'error',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status,
    code,
    message: error.message
  }));
  res.status(status).json({ success: false, error: message, code });
}