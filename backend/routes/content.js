import express from 'express';
import mongoose from 'mongoose';
import { body, param, query } from 'express-validator';
import Content from '../models/Content.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { requireAuth } from '../utils/auth.js';
import { applyCreditChange } from '../utils/credits.js';
import { ApiError, asyncHandler, validateRequest } from '../utils/http.js';

const router = express.Router();
const promptField = () => body('prompt').isString().withMessage('Prompt must be text').bail().trim().isLength({ min: 1, max: 5000 }).withMessage('Prompt must be 1 to 5000 characters');

router.post('/', requireAuth, [
  promptField(),
  body('response').isString().withMessage('Response must be text').bail().trim().isLength({ min: 1, max: 30000 }).withMessage('Response must be 1 to 30000 characters'),
  body('persona').optional({ nullable: true }).isString().withMessage('Persona must be text').bail().isLength({ max: 80 }).withMessage('Persona must be at most 80 characters'),
  body('tone').optional({ nullable: true }).isString().withMessage('Tone must be text').bail().isLength({ max: 40 }).withMessage('Tone must be at most 40 characters'),
  body('contentType').optional().isString().isLength({ max: 80 }).withMessage('Content type must be at most 80 characters'),
  body('outputLength').optional().isIn(['Short', 'Medium', 'Long']).withMessage('Choose a supported output length'),
  body('bookmarked').optional().isBoolean().toBoolean().withMessage('Bookmarked must be a boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let content;
  let user;
  try {
    await session.withTransaction(async () => {
      user = await applyCreditChange({
        userId: req.userId,
        amount: -1,
        reason: 'Content generation',
        source: 'generation',
        session
      });
      [content] = await Content.create([{
        userId: req.userId,
        prompt: req.body.prompt,
        response: req.body.response,
        persona: req.body.persona || 'Expert Copywriter',
        tone: req.body.tone || 'Professional',
        contentType: req.body.contentType || 'General',
        outputLength: req.body.outputLength || 'Medium',
        bookmarked: req.body.bookmarked || false
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  res.status(201).json({ success: true, data: content, credits: user.credits });
}));

router.get('/', requireAuth, [
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt().withMessage('Page must be a positive integer'),
  query('search').optional().isString().trim().isLength({ max: 200 }).withMessage('Search must be at most 200 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = 10;
  const criteria = { userId: req.userId };
  if (req.query.search) {
    const escapedSearch = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    criteria.prompt = { $regex: escapedSearch, $options: 'i' };
  }
  const data = await Content.find(criteria).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  const total = await Content.countDocuments(criteria);
  res.json({ success: true, data, total, pages: Math.ceil(total / limit) });
}));

router.get('/transactions', requireAuth, [
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt().withMessage('Page must be a positive integer'),
  validateRequest
], asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = 20;
  const [data, total] = await Promise.all([
    CreditTransaction.find({ userId: req.userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    CreditTransaction.countDocuments({ userId: req.userId })
  ]);
  res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
}));

router.put('/:id', requireAuth, [
  param('id').isMongoId().withMessage('Content ID is invalid'),
  body('prompt').optional().isString().withMessage('Prompt must be text').bail().trim().isLength({ min: 1, max: 5000 }).withMessage('Prompt must be 1 to 5000 characters'),
  body('response').optional().isString().withMessage('Response must be text').bail().trim().isLength({ min: 1, max: 30000 }).withMessage('Response must be 1 to 30000 characters'),
  body('persona').optional({ nullable: true }).isString().withMessage('Persona must be text').bail().isLength({ max: 80 }).withMessage('Persona must be at most 80 characters'),
  body('tone').optional({ nullable: true }).isString().withMessage('Tone must be text').bail().isLength({ max: 40 }).withMessage('Tone must be at most 40 characters'),
  body('contentType').optional().isString().isLength({ max: 80 }).withMessage('Content type must be at most 80 characters'),
  body('outputLength').optional().isIn(['Short', 'Medium', 'Long']).withMessage('Choose a supported output length'),
  body('bookmarked').optional().isBoolean().toBoolean().withMessage('Bookmarked must be a boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  const updates = Object.fromEntries(['prompt', 'response', 'persona', 'tone', 'contentType', 'outputLength', 'bookmarked']
    .filter((key) => req.body[key] !== undefined)
    .map((key) => [key, req.body[key]]));
  const content = await Content.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!content) throw new ApiError(404, 'Content not found.', 'CONTENT_NOT_FOUND');
  res.json({ success: true, data: content });
}));

router.delete('/:id', requireAuth, [
  param('id').isMongoId().withMessage('Content ID is invalid'),
  validateRequest
], asyncHandler(async (req, res) => {
  const deleted = await Content.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!deleted) throw new ApiError(404, 'Content not found.', 'CONTENT_NOT_FOUND');
  res.json({ success: true, data: { message: 'Deleted successfully.' }, message: 'Deleted successfully.' });
}));

export default router;
