import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Content from '../models/Content.js';
import CreditTransaction from '../models/CreditTransaction.js';

const mongoUri = process.env.MONGODB_TEST_URI;

test('generation API persists successful output and safely settles credit reservations', { skip: !mongoUri }, async (t) => {
  const originalFetch = globalThis.fetch;
  const secret = 'integration-test-jwt-secret-with-sufficient-entropy';
  let providerMode = 'success';
  let generationCalls = 0;

  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = secret;
  process.env.GEMINI_API_KEY = 'integration-test-key';
  process.env.PORT = '0';

  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname !== 'generativelanguage.googleapis.com') {
      return originalFetch(input, init);
    }
    if (url.pathname === '/v1beta/models') {
      return new Response(JSON.stringify({
        models: [{
          name: 'models/gemini-3.8-flash',
          supportedGenerationMethods: ['generateContent'],
          outputModalities: ['TEXT']
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    generationCalls += 1;
    if (providerMode === 'failure') {
      return new Response(JSON.stringify({ error: { message: 'Simulated provider outage' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Integration-tested generated copy.' }] } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  let server;
  try {
    const imported = await import('../server.js');
    server = imported.server;
    if (!server.listening) await once(server, 'listening');
    await mongoose.connection.asPromise();

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const createToken = (userId) => jwt.sign({ id: String(userId), type: 'access' }, secret, { expiresIn: '5m' });
    const requestGeneration = (token, prompt) => originalFetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ prompt })
    });

    await t.test('successful authenticated generation saves content and completes one reservation', async () => {
      const user = await User.create({
        name: 'Generation E2E',
        email: `generation-success-${new mongoose.Types.ObjectId()}@example.test`,
        password: 'not-a-real-password',
        credits: 2
      });
      const response = await requestGeneration(createToken(user._id), 'Write a product launch email');
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.result, 'Integration-tested generated copy.');
      assert.equal(body.credits, 1);
      assert.ok(body.id);

      const saved = await Content.findById(body.id);
      assert.equal(saved.userId.toString(), user._id.toString());
      assert.equal(saved.prompt, 'Write a product launch email');

      const reservation = await CreditTransaction.findOne({ userId: user._id, amount: -1 });
      assert.equal(reservation.metadata.status, 'completed');
      assert.equal((await User.findById(user._id)).credits, 1);
    });

    await t.test('provider failure refunds the reserved credit exactly once', async () => {
      const user = await User.create({
        name: 'Generation Failure',
        email: `generation-failure-${new mongoose.Types.ObjectId()}@example.test`,
        password: 'not-a-real-password',
        credits: 1
      });
      providerMode = 'failure';
      const response = await requestGeneration(createToken(user._id), 'Generate a launch announcement');
      const body = await response.json();
      providerMode = 'success';

      assert.equal(response.status, 502);
      assert.equal(body.code, 'AI_UNAVAILABLE');
      assert.equal((await User.findById(user._id)).credits, 1);

      const reservation = await CreditTransaction.findOne({ userId: user._id, amount: -1 });
      assert.equal(reservation.metadata.status, 'refunded');
      assert.equal(await CreditTransaction.countDocuments({
        userId: user._id,
        'metadata.status': 'refund'
      }), 1);
    });

    await t.test('insufficient credits stop before calling the generation provider', async () => {
      const user = await User.create({
        name: 'No Credits',
        email: `generation-empty-${new mongoose.Types.ObjectId()}@example.test`,
        password: 'not-a-real-password',
        credits: 0
      });
      const callsBefore = generationCalls;
      const response = await requestGeneration(createToken(user._id), 'Generate something');
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.code, 'INSUFFICIENT_CREDITS');
      assert.equal(generationCalls, callsBefore);
    });

    await t.test('guest generation does not create a paid user record', async () => {
      const contentBefore = await Content.countDocuments({});
      const response = await requestGeneration(null, 'Write a guest demo paragraph');
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.id, null);
      assert.equal(await Content.countDocuments({}), contentBefore);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
});
