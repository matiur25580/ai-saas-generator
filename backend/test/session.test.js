import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { rotateRefreshSession } from '../utils/session.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');

test('refresh rotation replaces the stored hash and returns access and refresh tokens', async () => {
  const oldToken = 'existing-refresh-token';
  let storedHash = hash(oldToken);
  const user = { _id: 'user-123', name: 'Test User', email: 'test@example.com', credits: 50 };
  const userModel = {
    async findOneAndUpdate(filter, update) {
      if (filter._id !== user._id || filter.refreshTokenHash !== storedHash) return null;
      storedHash = update.$set.refreshTokenHash;
      return user;
    }
  };

  const result = await rotateRefreshSession({ userModel, userId: user._id, currentRefreshToken: oldToken, secret: 'test-secret-with-enough-entropy' });

  assert.ok(result);
  assert.equal(storedHash, hash(result.refreshToken));
  assert.equal(jwt.verify(result.accessToken, 'test-secret-with-enough-entropy').type, 'access');
  assert.equal(jwt.verify(result.refreshToken, 'test-secret-with-enough-entropy').type, 'refresh');
  assert.equal(result.user, user);
});

test('only one concurrent request can rotate the same refresh token', async () => {
  const oldToken = 'single-use-refresh-token';
  let storedHash = hash(oldToken);
  const user = { _id: 'user-456' };
  const userModel = {
    async findOneAndUpdate(filter, update) {
      if (filter.refreshTokenHash !== storedHash) return null;
      storedHash = update.$set.refreshTokenHash;
      return user;
    }
  };

  const results = await Promise.all([
    rotateRefreshSession({ userModel, userId: user._id, currentRefreshToken: oldToken, secret: 'test-secret-with-enough-entropy' }),
    rotateRefreshSession({ userModel, userId: user._id, currentRefreshToken: oldToken, secret: 'test-secret-with-enough-entropy' })
  ]);

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.filter((result) => result === null).length, 1);
});

test('refresh rotation is bound to the current account token version', async () => {
  const oldToken = 'versioned-refresh-token';
  const user = { _id: 'user-versioned', tokenVersion: 3 };
  let receivedFilter;
  const userModel = {
    async findOneAndUpdate(filter) {
      receivedFilter = filter;
      return filter.tokenVersion === 3 ? user : null;
    }
  };

  const valid = await rotateRefreshSession({
    userModel, userId: user._id, currentRefreshToken: oldToken,
    secret: 'test-secret-with-enough-entropy', tokenVersion: 3
  });
  assert.ok(valid);
  assert.equal(jwt.verify(valid.accessToken, 'test-secret-with-enough-entropy').ver, 3);
  assert.equal(receivedFilter.tokenVersion, 3);

  const stale = await rotateRefreshSession({
    userModel, userId: user._id, currentRefreshToken: oldToken,
    secret: 'test-secret-with-enough-entropy', tokenVersion: 2
  });
  assert.equal(stale, null);
});
