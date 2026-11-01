import express from 'express';
import mongoose from 'mongoose';
import { body } from 'express-validator';
import User from '../models/User.js';
import Content from '../models/Content.js';
import { requireAdmin } from '../utils/auth.js';
import { applyCreditChange } from '../utils/credits.js';
import { ApiError, asyncHandler, validateRequest } from '../utils/http.js';

const router = express.Router();

router.get('/stats', requireAdmin, asyncHandler(async (req, res) => {
  const [totalUsers, totalGenerations, recentUsers, recentContent] = await Promise.all([
    User.countDocuments(),
    Content.countDocuments(),
    User.find().sort({ createdAt: -1 }).limit(10).select('name email credits role createdAt'),
    Content.find().sort({ createdAt: -1 }).limit(10).select('prompt persona tone createdAt')
  ]);
  const data = { stats: { totalUsers, totalGenerations }, recentUsers, recentContent };
  res.json({ success: true, data, ...data });
}));

router.post('/add-credits', requireAdmin, [
  body('email').isString().withMessage('Email must be text').bail().trim().isEmail().withMessage('Enter a valid user email').normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
  body('credits').isInt({ min: 1, max: 100000 }).toInt().withMessage('Credits must be an integer from 1 to 100000'),
  validateRequest
], asyncHandler(async (req, res) => {
  const target = await User.findOne({ email: req.body.email });
  if (!target) {
    throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');
  }
  const session = await mongoose.startSession();
  let user;
  try {
    await session.withTransaction(async () => {
      user = await applyCreditChange({
        userId: target._id,
        amount: req.body.credits,
        reason: 'Administrator credit grant',
        source: 'admin',
        metadata: { grantedBy: req.userId },
        session
      });
    });
  } finally {
    await session.endSession();
  }
  const data = { message: `${req.body.credits} credits added.`, credits: user.credits };
  res.json({ success: true, data, ...data });
}));

export default router;
