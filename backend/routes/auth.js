import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { body } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { rotateRefreshSession } from '../utils/session.js';
import { sendOtpEmail } from '../utils/sendEmail.js';
import MongoRateLimitStore from '../utils/MongoRateLimitStore.js';
import { ApiError, asyncHandler, validateRequest } from '../utils/http.js';

const router = express.Router();
const OTP_LIFETIME_MS = 3 * 60 * 1000;
const OTP_LOCK_MS = 10 * 60 * 1000;
const REFRESH_COOKIE = 'refreshToken';
const genericOtpResponse = {
  success: true,
  data: { message: 'If the account is eligible, a verification code will be sent.' },
  message: 'If the account is eligible, a verification code will be sent.',
  emailSent: true
};

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(500, 'Authentication is not configured. Please contact support.', 'AUTH_CONFIG_ERROR');
  }
  return secret;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function cookieOptions() {
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function clearCookieOptions() {
  const { maxAge, ...options } = cookieOptions();
  return options;
}

function csrfCookieOptions() {
  return { ...cookieOptions(), httpOnly: false };
}

function csrfProtection(req, res, next) {
  const cookieToken = req.cookies?.csrfToken || '';
  const headerToken = req.headers['x-csrf-token'] || '';
  const left = Buffer.from(String(cookieToken));
  const right = Buffer.from(String(headerToken));
  if (!left.length || left.length !== right.length || !timingSafeEqual(left, right)) {
    return next(new ApiError(403, 'CSRF validation failed.', 'CSRF_INVALID'));
  }
  next();
}

async function createSession(user, res) {
  const secret = jwtSecret();
  const tokenVersion = Number(user.tokenVersion ?? 0);
  const accessToken = jwt.sign({
    id: user._id.toString(), type: 'access', ver: tokenVersion
  }, secret, { expiresIn: '15m', algorithm: 'HS256' });
  const refreshToken = jwt.sign({
    id: user._id.toString(), type: 'refresh', jti: randomUUID(), ver: tokenVersion
  }, secret, { expiresIn: '7d', algorithm: 'HS256' });
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
  const csrfToken = randomUUID() + randomUUID();
  res.cookie('csrfToken', csrfToken, csrfCookieOptions());
  return { accessToken, csrfToken };
}

const otpIpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore({ prefix: 'auth:otp:ip:' }),
  handler: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many verification requests from this network. Please try again in 10 minutes.',
    code: 'OTP_IP_RATE_LIMITED'
  })
});

const otpEmailRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore({ prefix: 'auth:otp:email:' }),
  keyGenerator: (req) => 'email:' + createHash('sha256').update(String(req.body?.email || '').trim().toLowerCase()).digest('hex'),
  handler: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many OTP requests. Please try again in 10 minutes.',
    code: 'OTP_RATE_LIMITED'
  })
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore({ prefix: 'auth:login:ip:' }),
  handler: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'LOGIN_RATE_LIMITED'
  })
});

const emailField = (field = 'email') => body(field)
  .isString().withMessage('Email must be text').bail()
  .trim()
  .isEmail().withMessage('Enter a valid email address')
  .customSanitizer((value) => value.toLowerCase());
const passwordField = (field = 'password') => body(field)
  .isString().withMessage('Password must be text')
  .bail()
  .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters');

function otpDigest(email, purpose, otp) {
  return createHmac('sha256', jwtSecret()).update(email + ':' + purpose + ':' + otp).digest('hex');
}

async function verifyOtp(email, purpose, submittedOtp) {
  const record = await Otp.findOne({ email, purpose });
  const now = new Date();
  if (!record || record.expiresAt <= now || (record.lockedUntil && record.lockedUntil > now)) {
    throw new ApiError(400, 'Invalid or expired verification code.', 'OTP_INVALID_OR_EXPIRED');
  }

  const submittedHash = otpDigest(email, purpose, submittedOtp);
  const expectedHash = record.otp || '';
  const matches = expectedHash.length === submittedHash.length
    && timingSafeEqual(Buffer.from(expectedHash), Buffer.from(submittedHash));
  if (!matches) {
    await Otp.findOneAndUpdate(
      {
        _id: record._id,
        otp: expectedHash,
        expiresAt: { $gt: now },
        failedAttempts: { $lt: 5 },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }]
      },
      [
        { $set: { failedAttempts: { $add: [{ $ifNull: ['$failedAttempts', 0] }, 1] } } },
        { $set: {
          lockedUntil: { $cond: [{ $gte: ['$failedAttempts', 5] }, new Date(now.getTime() + OTP_LOCK_MS), '$lockedUntil'] },
          expiresAt: { $cond: [{ $gte: ['$failedAttempts', 5] }, new Date(now.getTime() + OTP_LOCK_MS), '$expiresAt'] }
        } }
      ],
      { new: true }
    );
    const updated = await Otp.findById(record._id).select('failedAttempts');
    if (updated?.failedAttempts >= 5) {
      throw new ApiError(429, 'Too many incorrect verification attempts. Request a new code after 10 minutes.', 'OTP_LOCKED');
    }
    throw new ApiError(400, 'Invalid or expired verification code.', 'OTP_INVALID_OR_EXPIRED');
  }
  if (record.failedAttempts >= 5) {
    throw new ApiError(429, 'Too many incorrect verification attempts. Request a new code after 10 minutes.', 'OTP_LOCKED');
  }
  return record;
}

async function consumeOtpRecord(record, session) {
  const now = new Date();
  const consumed = await Otp.findOneAndDelete({
    _id: record._id,
    otp: record.otp,
    expiresAt: { $gt: now },
    failedAttempts: { $lt: 5 },
    $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }]
  }, { session });
  if (!consumed) {
    throw new ApiError(400, 'Invalid or expired verification code.', 'OTP_INVALID_OR_EXPIRED');
  }
}

router.post('/send-otp', otpIpRateLimit, otpEmailRateLimit, [
  emailField(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 80 }).withMessage('Name must be 1 to 80 characters'),
  body('purpose').isString().withMessage('Purpose must be text').bail().isIn(['signup', 'reset']).withMessage('Purpose must be signup or reset'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email, name, purpose } = req.body;
  const existing = await User.exists({ email });
  const eligible = purpose === 'signup' ? !existing : Boolean(existing);
  if (!eligible) return res.status(202).json(genericOtpResponse);

  const currentOtp = await Otp.findOne({ email, purpose });
  if (currentOtp?.lockedUntil && currentOtp.lockedUntil > new Date()) {
    return res.status(202).json(genericOtpResponse);
  }

  const otp = String(randomInt(100000, 1000000));
  const otpHash = otpDigest(email, purpose, otp);
  await Otp.findOneAndUpdate(
    { email, purpose },
    { $set: { otp: otpHash, failedAttempts: 0, lockedUntil: null, expiresAt: new Date(Date.now() + OTP_LIFETIME_MS) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  try {
    await sendOtpEmail(email, otp, purpose, name);
  } catch (error) {
    await Otp.deleteOne({ email, purpose, otp: otpHash });
    console.error(JSON.stringify({ level: 'error', event: 'otp_delivery_failed', error: error.code || error.name }));
  }
  return res.status(202).json(genericOtpResponse);
}));

router.post('/register', [
  body('name').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Name must be 1 to 80 characters'),
  emailField(),
  passwordField(),
  body('otp').isString().withMessage('OTP must be text').bail().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit code'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { name, email, password, otp } = req.body;
  if (await User.exists({ email })) {
    throw new ApiError(400, 'Invalid or expired verification code.', 'OTP_INVALID_OR_EXPIRED');
  }
  const otpRecord = await verifyOtp(email, 'signup', otp);
  const passwordHash = await bcrypt.hash(password, 12);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await consumeOtpRecord(otpRecord, session);
      const [user] = await User.create([{ name, email, password: passwordHash }], { session });
      await CreditTransaction.create([{
        userId: user._id,
        amount: user.credits,
        balanceAfter: user.credits,
        reason: 'Welcome credits',
        source: 'signup'
      }], { session });
    });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(400, 'Invalid or expired verification code.', 'OTP_INVALID_OR_EXPIRED');
    throw error;
  } finally {
    await session.endSession();
  }
  res.status(201).json({ success: true, data: { message: 'Successfully registered. Please log in.' }, message: 'Successfully registered. Please log in.' });
}));

router.post('/login', loginRateLimit, [
  emailField(),
  body('password').isString().withMessage('Password is required').bail().isLength({ min: 1, max: 128 }).withMessage('Password is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }
  const session = await createSession(user, res);
  const account = { name: user.name, email: user.email, credits: user.credits, role: user.role };
  res.json({ success: true, data: { token: session.accessToken, user: account, csrfToken: session.csrfToken }, token: session.accessToken, user: account, csrfToken: session.csrfToken });
}));

router.get('/csrf', (req, res) => {
  const csrfToken = req.cookies?.csrfToken || randomUUID() + randomUUID();
  res.cookie('csrfToken', csrfToken, csrfCookieOptions());
  res.json({ success: true, data: { csrfToken }, csrfToken });
});

router.post('/refresh', csrfProtection, asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new ApiError(401, 'Please log in again.', 'REFRESH_TOKEN_MISSING');
  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
  } catch {
    res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
    throw new ApiError(401, 'Please log in again.', 'REFRESH_TOKEN_INVALID');
  }
  if (decoded.type !== 'refresh' || typeof decoded.id !== 'string') {
    res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
    throw new ApiError(401, 'Please log in again.', 'REFRESH_TOKEN_INVALID');
  }
  const tokenVersion = Number(decoded.ver ?? 0);
  const versionCriteria = tokenVersion === 0
    ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
    : { tokenVersion };
  const user = await User.findOne({
    _id: decoded.id,
    refreshTokenHash: hashToken(token),
    isActive: { $ne: false },
    ...versionCriteria
  });
  if (!user) {
    res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
    throw new ApiError(401, 'Please log in again.', 'REFRESH_TOKEN_REVOKED');
  }
  const rotated = await rotateRefreshSession({
    userModel: User, userId: user._id, currentRefreshToken: token, secret: jwtSecret(), tokenVersion
  });
  if (!rotated) {
    res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
    throw new ApiError(401, 'Please log in again.', 'REFRESH_TOKEN_ALREADY_USED');
  }
  res.cookie(REFRESH_COOKIE, rotated.refreshToken, cookieOptions());
  const account = { name: rotated.user.name, email: rotated.user.email, credits: rotated.user.credits, role: rotated.user.role };
  const csrfToken = req.cookies?.csrfToken;
  res.json({ success: true, data: { token: rotated.accessToken, user: account, csrfToken }, token: rotated.accessToken, user: account, csrfToken });
}));

router.post('/logout', csrfProtection, asyncHandler(async (req, res) => {
  const candidates = [];
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  const authorization = req.headers.authorization || '';
  const [scheme, accessToken] = authorization.split(' ');

  if (scheme === 'Bearer' && accessToken) {
    try {
      const decoded = jwt.verify(accessToken, jwtSecret(), { algorithms: ['HS256'] });
      if (decoded.type === 'access' && typeof decoded.id === 'string') {
        candidates.push({ id: decoded.id, ver: Number(decoded.ver ?? 0) });
      }
    } catch { /* Continue with the refresh cookie if available. */ }
  }

  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, jwtSecret(), { algorithms: ['HS256'] });
      if (decoded.type === 'refresh' && typeof decoded.id === 'string') {
        candidates.push({
          id: decoded.id,
          ver: Number(decoded.ver ?? 0),
          refreshHash: hashToken(refreshToken)
        });
      }
    } catch { /* Expired cookies are still cleared below. */ }
  }

  for (const identity of candidates) {
    const versionCriteria = identity.ver === 0
      ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
      : { tokenVersion: identity.ver };
    const criteria = { _id: identity.id, isActive: { $ne: false }, ...versionCriteria };
    if (identity.refreshHash) criteria.refreshTokenHash = identity.refreshHash;
    const result = await User.updateOne(criteria, {
      $inc: { tokenVersion: 1 },
      $set: { refreshTokenHash: null }
    });
    if (result.matchedCount > 0) break;
  }

  res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
  res.clearCookie('csrfToken', { ...clearCookieOptions(), httpOnly: false });
  res.json({ success: true, data: { message: 'Logged out successfully.' }, message: 'Logged out successfully.' });
}));

router.post('/reset-password', [
  emailField(),
  body('otp').isString().withMessage('OTP must be text').bail().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit code'),
  passwordField('newPassword'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const otpRecord = await verifyOtp(email, 'reset', otp);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await consumeOtpRecord(otpRecord, session);
      const user = await User.findOneAndUpdate(
        { email, isActive: { $ne: false } },
        {
          $set: { password: passwordHash, refreshTokenHash: null },
          $inc: { tokenVersion: 1 }
        },
        { new: true, session }
      );
      if (!user) throw new ApiError(400, 'Invalid or expired verification code.', 'OTP_INVALID_OR_EXPIRED');
    });
  } finally {
    await session.endSession();
  }
  res.json({ success: true, data: { message: 'Password reset successfully. Please log in.' }, message: 'Password reset successfully. Please log in.' });
}));

export default router;
