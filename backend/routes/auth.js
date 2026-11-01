import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { body } from 'express-validator';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { sendOtpEmail } from '../utils/sendEmail.js';
import { ApiError, asyncHandler, validateRequest } from '../utils/http.js';

const router = express.Router();
const OTP_LIFETIME_MS = 3 * 60 * 1000;
const OTP_LOCK_MS = 10 * 60 * 1000;
const REFRESH_COOKIE = 'refreshToken';

function jwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, 'Authentication is not configured. Please contact support.', 'AUTH_CONFIG_ERROR');
  }
  return process.env.JWT_SECRET;
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

async function createSession(user, res) {
  const secret = jwtSecret();
  const accessToken = jwt.sign({ id: user._id.toString(), type: 'access' }, secret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user._id.toString(), type: 'refresh' }, secret, { expiresIn: '7d' });
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
  return accessToken;
}

const otpIpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
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
  keyGenerator: (req) => `email:${String(req.body?.email || '').trim().toLowerCase()}`,
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

router.post('/send-otp', otpIpRateLimit, otpEmailRateLimit, [
  emailField(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 80 }).withMessage('Name must be 1 to 80 characters'),
  body('purpose').isString().withMessage('Purpose must be text').bail().isIn(['signup', 'reset']).withMessage('Purpose must be signup or reset'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email, name, purpose } = req.body;
  const existing = await User.findOne({ email });
  if (purpose === 'signup' && existing) {
    throw new ApiError(400, 'This email is already registered. Please log in.', 'EMAIL_ALREADY_REGISTERED');
  }
  if (purpose === 'reset' && !existing) {
    throw new ApiError(400, "This email isn't registered. Please sign up first.", 'EMAIL_NOT_FOUND');
  }

  const currentOtp = await Otp.findOne({ email, purpose });
  if (currentOtp?.lockedUntil && currentOtp.lockedUntil > new Date()) {
    throw new ApiError(429, 'Too many incorrect OTP attempts. Request a new code after the 10-minute lock expires.', 'OTP_LOCKED');
  }

  const otp = String(randomInt(100000, 1000000));
  const otpHash = createHmac('sha256', jwtSecret())
    .update(`${email}:${purpose}:${otp}`)
    .digest('hex');
  await Otp.findOneAndUpdate(
    { email, purpose },
    { $set: { otp: otpHash, failedAttempts: 0, lockedUntil: null, expiresAt: new Date(Date.now() + OTP_LIFETIME_MS) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  try {
    await sendOtpEmail(email, otp, purpose, name);
  } catch (error) {
    await Otp.deleteOne({ email, purpose, otp: otpHash });
    if (error.code === 'EMAIL_NOT_CONFIGURED') {
      throw new ApiError(503, 'Email delivery is not configured. Please contact support.', 'EMAIL_NOT_CONFIGURED');
    }
    throw new ApiError(503, 'We could not send your verification email. Please try again later.', 'EMAIL_DELIVERY_FAILED');
  }
  res.json({ success: true, data: { message: 'A verification code was sent to your email.', emailSent: true }, message: 'A verification code was sent to your email.', emailSent: true });
}));

async function consumeOtp(email, purpose, submittedOtp) {
  const record = await Otp.findOne({ email, purpose });
  if (!record) {
    throw new ApiError(400, 'Invalid or expired OTP.', 'OTP_INVALID_OR_EXPIRED');
  }
  if (record.lockedUntil && record.lockedUntil > new Date()) {
    throw new ApiError(429, 'Too many incorrect OTP attempts. Try again after 10 minutes.', 'OTP_LOCKED');
  }
  if (record.expiresAt <= new Date()) {
    throw new ApiError(400, 'Invalid or expired OTP.', 'OTP_INVALID_OR_EXPIRED');
  }
  const submittedHash = createHmac('sha256', jwtSecret())
    .update(`${email}:${purpose}:${submittedOtp}`)
    .digest('hex');
  const expectedHash = record.otp || '';
  const matches = expectedHash.length === submittedHash.length
    && timingSafeEqual(Buffer.from(expectedHash), Buffer.from(submittedHash));
  if (!matches) {
    const now = new Date();
    await Otp.findOneAndUpdate(
      { _id: record._id, otp: expectedHash, expiresAt: { $gt: now } },
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
      throw new ApiError(429, 'Too many incorrect OTP attempts. Try again after 10 minutes.', 'OTP_LOCKED');
    }
    throw new ApiError(400, 'Invalid or expired OTP.', 'OTP_INVALID_OR_EXPIRED');
  }
  const consumed = await Otp.findOneAndDelete({
    _id: record._id,
    otp: expectedHash,
    expiresAt: { $gt: new Date() },
    $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }]
  });
  if (!consumed) {
    throw new ApiError(400, 'Invalid or expired OTP.', 'OTP_INVALID_OR_EXPIRED');
  }
}

router.post('/register', [
  body('name').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Name must be 1 to 80 characters'),
  emailField(),
  passwordField(),
  body('otp').isString().withMessage('OTP must be text').bail().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit code'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { name, email, password, otp } = req.body;
  if (await User.findOne({ email })) {
    throw new ApiError(400, 'This email is already registered. Please log in.', 'EMAIL_ALREADY_REGISTERED');
  }
  const hash = await bcrypt.hash(password, 12);
  await consumeOtp(email, 'signup', otp);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [user] = await User.create([{ name, email, password: hash }], { session });
      await CreditTransaction.create([{
        userId: user._id,
        amount: user.credits,
        balanceAfter: user.credits,
        reason: 'Welcome credits',
        source: 'signup'
      }], { session });
    });
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
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }
  const token = await createSession(user, res);
  const account = { name: user.name, email: user.email, credits: user.credits };
  res.json({ success: true, data: { token, user: account }, token, user: account });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new ApiError(401, 'Please log in again.', 'REFRESH_TOKEN_MISSING');
  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret());
  } catch {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw new ApiError(401, 'Please log in again.', 'REFRESH_TOKEN_INVALID');
  }
  if (decoded.type !== 'refresh') {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw new ApiError(401, 'Please log in again.', 'REFRESH_TOKEN_INVALID');
  }
  const user = await User.findOne({ _id: decoded.id, refreshTokenHash: hashToken(token) });
  if (!user) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw new ApiError(401, 'Please log in again.', 'REFRESH_TOKEN_REVOKED');
  }
  const accessToken = await createSession(user, res);
  const account = { name: user.name, email: user.email, credits: user.credits };
  res.json({ success: true, data: { token: accessToken, user: account }, token: accessToken, user: account });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret());
      await User.updateOne({ _id: decoded.id, refreshTokenHash: hashToken(token) }, { $set: { refreshTokenHash: null } });
    } catch {
      // Clear invalid or expired cookies as well.
    }
  }
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.json({ success: true, data: { message: 'Logged out successfully.' }, message: 'Logged out successfully.' });
}));

router.post('/reset-password', [
  emailField(),
  body('otp').isString().withMessage('OTP must be text').bail().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit code'),
  passwordField('newPassword'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, "This email isn't registered. Please sign up first.", 'EMAIL_NOT_FOUND');
  await consumeOtp(email, 'reset', otp);
  user.password = await bcrypt.hash(newPassword, 12);
  user.refreshTokenHash = null;
  await user.save();
  res.json({ success: true, data: { message: 'Password reset successfully. Please log in.' }, message: 'Password reset successfully. Please log in.' });
}));

export default router;
