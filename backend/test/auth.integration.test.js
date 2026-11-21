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
  let activePassword = 'A-strong-test-password-123';
  let deliveredHtml = '';
  const deliveredOtps = new Map();

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
      const deliveredEmail = payload.to[0].email.toLowerCase();
      const deliveredMatch = payload.htmlContent.match(/>(\d{6})<\/div>/);
      if (deliveredMatch) deliveredOtps.set(deliveredEmail, deliveredMatch[1]);
      if (deliveredEmail === email) deliveredHtml = payload.htmlContent;
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
    await imported.databaseReady;
    await mongoose.connection.asPromise();

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const post = (path, body, cookie, csrf) => originalFetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {})
      },
      body: JSON.stringify(body)
    });
    const cookieFrom = (response, fallbackCsrfToken) => {
      const setCookie = response.headers.get('set-cookie') || '';
      const refreshMatch = setCookie.match(/refreshToken=([^;]+)/);
      const csrfMatch = setCookie.match(/csrfToken=([^;]+)/);
      const csrfValue = csrfMatch?.[1] || fallbackCsrfToken;
      return refreshMatch && csrfValue ? `refreshToken=${refreshMatch[1]}; csrfToken=${csrfValue}` : null;
    };

    await t.test('signup OTP is delivered, consumed once, and grants welcome credits transactionally', async () => {
      const sendResponse = await post('/api/auth/send-otp', { email, name: 'Auth Integration', purpose: 'signup' });
      const sendBody = await sendResponse.json();
      assert.equal(sendResponse.status, 202);
      assert.equal(sendBody.success, true);

      const otpMatch = deliveredHtml.match(/>(\d{6})<\/div>/);
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

      const existingSignup = await post('/api/auth/send-otp', { email, purpose: 'signup' });
      const unknownReset = await post('/api/auth/send-otp', { email: `unknown-${new mongoose.Types.ObjectId()}@example.test`, purpose: 'reset' });
      assert.equal(existingSignup.status, 202);
      assert.equal(unknownReset.status, 202);
      assert.deepEqual(await existingSignup.json(), await unknownReset.json());

      const replayResponse = await post('/api/auth/register', {
        name: 'Auth Integration',
        email,
        password: 'A-strong-test-password-123',
        otp
      });
      assert.equal(replayResponse.status, 400);
    });

    await t.test('password reset consumes OTP transactionally and revokes existing access tokens', async () => {
      const oldLogin = await post('/api/auth/login', { email, password: activePassword });
      const oldLoginBody = await oldLogin.json();
      assert.equal(oldLogin.status, 200);

      const resetSend = await post('/api/auth/send-otp', { email, purpose: 'reset' });
      assert.equal(resetSend.status, 202);
      const resetOtp = deliveredOtps.get(email);
      assert.match(resetOtp || '', /^\d{6}$/);

      const resetResponse = await post('/api/auth/reset-password', {
        email, otp: resetOtp, newPassword: 'A-new-strong-test-password-456'
      });
      assert.equal(resetResponse.status, 200);

      const oldAccess = await originalFetch(`${baseUrl}/api/content/transactions`, {
        headers: { Authorization: `Bearer ${oldLoginBody.token}` }
      });
      assert.equal(oldAccess.status, 401);
      assert.equal((await oldAccess.json()).code, 'AUTH_REVOKED');

      const oldPasswordLogin = await post('/api/auth/login', { email, password: activePassword });
      assert.equal(oldPasswordLogin.status, 401);
      activePassword = 'A-new-strong-test-password-456';
    });

    await t.test('login issues an HttpOnly refresh cookie and refresh tokens are single-use', async () => {
      const loginResponse = await post('/api/auth/login', { email, password: activePassword });
      const loginBody = await loginResponse.json();
      const initialCookie = cookieFrom(loginResponse);

      assert.equal(loginResponse.status, 200);
      assert.equal(loginBody.success, true);
      assert.ok(loginBody.token);
      assert.ok(initialCookie);
      assert.match(loginResponse.headers.get('set-cookie'), /HttpOnly/i);

      const csrfRejected = await post('/api/auth/refresh', {}, initialCookie);
      assert.equal(csrfRejected.status, 403);

      const refreshResponse = await post('/api/auth/refresh', {}, initialCookie, loginBody.csrfToken);
      const refreshBody = await refreshResponse.json();
      const rotatedCookie = cookieFrom(refreshResponse, loginBody.csrfToken);
      assert.equal(refreshResponse.status, 200);
      assert.ok(refreshBody.token);
      assert.ok(rotatedCookie);
      assert.notEqual(rotatedCookie, initialCookie);

      const replayResponse = await post('/api/auth/refresh', {}, initialCookie, loginBody.csrfToken);
      const replayBody = await replayResponse.json();
      assert.equal(replayResponse.status, 401);
      assert.equal(replayBody.code, 'REFRESH_TOKEN_REVOKED');

      const logoutResponse = await post('/api/auth/logout', {}, rotatedCookie, refreshBody.csrfToken);
      const logoutBody = await logoutResponse.json();
      assert.equal(logoutResponse.status, 200);
      assert.equal(logoutBody.success, true);

      const afterLogoutResponse = await post('/api/auth/refresh', {}, rotatedCookie, refreshBody.csrfToken);
      const afterLogoutBody = await afterLogoutResponse.json();
      assert.equal(afterLogoutResponse.status, 401);
      assert.equal(afterLogoutBody.code, 'REFRESH_TOKEN_REVOKED');

      const revokedAccess = await originalFetch(`${baseUrl}/api/content/transactions`, {
        headers: { Authorization: `Bearer ${loginBody.token}` }
      });
      const revokedAccessBody = await revokedAccess.json();
      assert.equal(revokedAccess.status, 401);
      assert.equal(revokedAccessBody.code, 'AUTH_REVOKED');
    });

    await t.test('five invalid OTP attempts lock the verification record', async () => {
      const lockEmail = `auth-lock-${new mongoose.Types.ObjectId()}@example.test`;
      const sendResponse = await post('/api/auth/send-otp', { email: lockEmail, purpose: 'signup' });
      assert.equal(sendResponse.status, 202);
      const correctOtp = deliveredOtps.get(lockEmail);
      const wrongOtp = correctOtp === '999999' ? '000000' : '999999';

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const invalidResponse = await post('/api/auth/register', {
          name: 'OTP Lock Test',
          email: lockEmail,
          password: 'A-strong-test-password-123',
          otp: wrongOtp
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
