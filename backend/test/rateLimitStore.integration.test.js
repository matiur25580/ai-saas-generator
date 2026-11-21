import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import RateLimit from '../models/RateLimit.js';
import MongoRateLimitStore from '../utils/MongoRateLimitStore.js';

const mongoUri = process.env.MONGODB_TEST_URI;
const enabled = Boolean(mongoUri);
let store;

before(async () => {
  if (!enabled) return;
  await mongoose.connect(mongoUri);
  await RateLimit.init();
  store = new MongoRateLimitStore({ prefix: 'integration:' + randomUUID() + ':' });
  store.init({ windowMs: 60_000 });
});

after(async () => {
  if (enabled) {
    await store?.resetAll();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
});

test('MongoDB rate-limit store atomically counts concurrent requests and supports reset', { skip: !enabled }, async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => store.increment('same-client')));
  const counts = results.map((result) => result.totalHits).sort((a, b) => a - b);
  assert.deepEqual(counts, Array.from({ length: 20 }, (_, index) => index + 1));

  const current = await store.get('same-client');
  assert.equal(current.totalHits, 20);
  assert.ok(current.resetTime instanceof Date);

  await store.decrement('same-client');
  assert.equal((await store.get('same-client')).totalHits, 19);
  await store.resetKey('same-client');
  assert.equal(await store.get('same-client'), undefined);
});
