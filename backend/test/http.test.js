import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../utils/http.js';

function invokeErrorHandler(error) {
  let statusCode;
  let responseBody;
  const req = { method: 'POST', path: '/api/example' };
  const res = {
    headersSent: false,
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  const originalError = console.error;
  console.error = () => {};
  try {
    errorHandler(error, req, res, (nextError) => {
      throw nextError;
    });
  } finally {
    console.error = originalError;
  }

  return { statusCode, responseBody };
}

test('malformed JSON receives a safe, structured 400 response', () => {
  const result = invokeErrorHandler({
    name: 'SyntaxError',
    type: 'entity.parse.failed',
    status: 400,
    message: 'Parser detail that must not reach the client'
  });

  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.responseBody, {
    success: false,
    error: 'Request body must contain valid JSON.',
    code: 'INVALID_JSON'
  });
});

test('oversized JSON receives a safe, structured 413 response', () => {
  const result = invokeErrorHandler({
    name: 'PayloadTooLargeError',
    type: 'entity.too.large',
    status: 413,
    message: 'Internal parser detail'
  });

  assert.equal(result.statusCode, 413);
  assert.deepEqual(result.responseBody, {
    success: false,
    error: 'Request body exceeds the allowed size.',
    code: 'PAYLOAD_TOO_LARGE'
  });
});

test('unexpected server errors do not expose internal messages', () => {
  const result = invokeErrorHandler(new Error('Database connection string must remain private'));

  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.responseBody, {
    success: false,
    error: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_ERROR'
  });
});
