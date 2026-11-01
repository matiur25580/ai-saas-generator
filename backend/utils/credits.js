import User from '../models/User.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { ApiError } from './http.js';

export async function applyCreditChange({ userId, amount, reason, source, metadata = {}, session }) {
  const existingUser = await User.findById(userId).session(session);
  if (!existingUser) throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');

  const criteria = { _id: userId };
  if (amount < 0) criteria.credits = { $gte: Math.abs(amount) };
  const user = await User.findOneAndUpdate(criteria, { $inc: { credits: amount } }, { new: true, session });
  if (!user) throw new ApiError(400, 'Not enough credits for this action.', 'INSUFFICIENT_CREDITS');

  await CreditTransaction.create([{
    userId,
    amount,
    balanceAfter: user.credits,
    reason,
    source,
    metadata
  }], { session });
  return user;
}