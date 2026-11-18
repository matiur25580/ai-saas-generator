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
  const isDuplicate = error.code === 11000;
  const isValidation = error.name === 'ValidationError';
  const isInvalidId = error.name === 'CastError';
  const isMalformedJson = error.type === 'entity.parse.failed';
  const isPayloadTooLarge = error.type === 'entity.too.large';
  const isHttpError = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599;
  const status = isDuplicate ? 409
    : isValidation || isInvalidId || isMalformedJson ? 400
      : isPayloadTooLarge ? 413
        : isHttpError ? error.status : 500;
  const code = isDuplicate ? 'RESOURCE_CONFLICT'
    : isValidation ? 'VALIDATION_ERROR'
      : isInvalidId ? 'INVALID_ID'
        : isMalformedJson ? 'INVALID_JSON'
          : isPayloadTooLarge ? 'PAYLOAD_TOO_LARGE'
            : typeof error.code === 'string' ? error.code
              : status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
  const message = status >= 500 && code === 'INTERNAL_ERROR'
    ? 'An unexpected error occurred. Please try again later.'
    : isDuplicate ? 'A record with these details already exists.'
      : isValidation ? 'The submitted data is invalid.'
        : isInvalidId ? 'The requested identifier is invalid.'
          : isMalformedJson ? 'Request body must contain valid JSON.'
            : isPayloadTooLarge ? 'Request body exceeds the allowed size.'
              : error.message;
  console.error(JSON.stringify({
    level: 'error',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status,
    code,
    message: status >= 500 ? (error.name || 'ServerError') : error.message
  }));
  res.status(status).json({ success: false, error: message, code });
}