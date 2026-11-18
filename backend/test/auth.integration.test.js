import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import CreditTransaction from '../models/CreditTransaction.js';

const mongoUri = process.env.MONGODB_TEST_URI;

test('auth API verifies OTP, creates accounts, and rotates refresh sessions safely', { skip: !mongoUri }, async (t) => {
  const originalFetch = globalThis.fetch;
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
    PORT: process.env.PORT
  };
  const secret = 'auth-integration-test-secret-with-sufficient-entropy';
  const email = `auth-success-${new mongoose.Types.ObjectId()}@example.test`;
  let deliveredHtml = '';

  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = secret;
  process.env.BREVO_API_KEY = 'integration-test-brevo-key';
  process.env.BREVO_SENDER_EMAIL = 'noreply@example.test';
  process.env.PORT = '0';

  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname === 'api.brevo.com') {
      const payload = JSON.parse(init.body);
      assert.equal(payload.to[0].email, email);
      deliveredHtml = payload.htmlContent;
      return new Response(JSON.stringify({ messageId: 'integration-test-message' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(input, init);
  };

  let server;
  try {
    const imported = await import('../server.js');
    server = imported.server;
    if (!server.listening) await once(server, 'listening');
    await mongoose.connection.asPromise();

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const post = (path, body, cookie) => originalFetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: JSON.stringify(body)
    });
    const cookieFrom = (response) => {
      const setCookie = response.headers.get('set-cookie') || '';
      const match = setCookie.match(/refreshToken=([^;]+)/);
      return match ? `refreshToken=${match[1]}` : null;
    };

    await t.test('signup OTP is delivered, consumed once, and grants welcome credits transactionally', async () => {
      const sendResponse = await post('/api/auth/send-otp', { email, name: 'Auth Integration', purpose: 'signup' });
      const sendBody = await sendResponse.json();
      assert.equal(sendResponse.status, 200);
      assert.equal(sendBody.emailSent, true);

      const otpMatch = deliveredHtml.match(/>(\\d{6})<\\/div>/);
      assert.ok(otpMatch, 'mock email should contain the generated six-digit OTP');
      const otp = otpMatch[1];

      const registerResponse = await post('/api/auth/register', {
        name: 'Auth Integration',
        email,
        password: 'A-strong-test-password-123',
        otp
      });
      const registerBody = await registerResponse.json();
      assert.equal(registerResponse.status, 201);
      assert.equal(registerBody.success, true);

      const user = await User.findOne({ email });
      assert.ok(user);
      assert.equal(user.credits, 50);
      assert.equal(await CreditTransaction.countDocuments({ userId: user._id, source: 'signup', amount: 50 }), 1);
      assert.equal(await Otp.countDocuments({ email, purpose: 'signup' }), 0);

      const replayResponse = await post('/api/auth/register', {
        name: 'Auth Integration',
        email,
        password: 'A-strong-test-password-123',
        otp
      });
      assert.equal(replayResponse.status, 400);
    });

    await t.test('login issues an HttpOnly refresh cookie and refresh tokens are single-use', async () => {
      const loginResponse = await post('/api/auth/login', { email, password: 'A-strong-test-password-123' });
      const loginBody = await loginResponse.json();
      const initialCookie = cookieFrom(loginResponse);

      assert.equal(loginResponse.status, 200);
      assert.equal(loginBody.success, true);
      assert.ok(loginBody.token);
      assert.ok(initialCookie);
      assert.match(loginResponse.headers.get('set-cookie'), /HttpOnly/i);

      const refreshResponse = await post('/api/auth/refresh', {}, initialCookie);
      const refreshBody = await refreshResponse.json();
      const rotatedCookie = cookieFrom(refreshResponse);
      assert.equal(refreshResponse.status, 200);
      assert.ok(refreshBody.token);
      assert.ok(rotatedCookie);
      assert.notEqual(rotatedCookie, initialCookie);

      const replayResponse = await post('/api/auth/refresh', {}, initialCookie);
      const replayBody = await replayResponse.json();
      assert.equal(replayResponse.status, 401);
      assert.equal(replayBody.code, 'REFRESH_TOKEN_REVOKED');
    });

    await t.test('five invalid OTP attempts lock the verification record', async () => {
      const lockEmail = `auth-lock-${new mongoose.Types.ObjectId()}@example.test`;
      const sendResponse = await post('/api/auth/send-otp', { email: lockEmail, purpose: 'signup' });
      assert.equal(sendResponse.status, 200);

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const invalidResponse = await post('/api/auth/register', {
          name: 'OTP Lock Test',
          email: lockEmail,
          password: 'A-strong-test-password-123',
          otp: '000000'
        });
        assert.equal(invalidResponse.status, attempt === 5 ? 429 : 400);
      }

      const otpRecord = await Otp.findOne({ email: lockEmail, purpose: 'signup' });
      assert.ok(otpRecord.lockedUntil > new Date());
      assert.equal(otpRecord.failedAttempts, 5);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
