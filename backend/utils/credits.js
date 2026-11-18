import mongoose from 'mongoose';
import User from '../models/User.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { ApiError } from './http.js';
import { reconcileReservations } from './generationReservations.js';

export async function applyCreditChange({ userId, amount, reason, source, metadata = {}, session, includeTransaction = false }) {
  const existingUser = await User.findById(userId).session(session);
  if (!existingUser) throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');

  const criteria = { _id: userId };
  if (amount < 0) criteria.credits = { $gte: Math.abs(amount) };
  const user = await User.findOneAndUpdate(criteria, { $inc: { credits: amount } }, { new: true, session });
  if (!user) throw new ApiError(400, 'Not enough credits for this action.', 'INSUFFICIENT_CREDITS');

  const [transaction] = await CreditTransaction.create([{
    userId,
    amount,
    balanceAfter: user.credits,
    reason,
    source,
    metadata
  }], { session });
  return includeTransaction ? { user, transaction } : user;
}

export async function refundGenerationReservation({ userId, reservationId }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const reservation = await CreditTransaction.findOneAndUpdate(
        { _id: reservationId, userId, source: 'generation', 'metadata.status': 'reserved' },
        { $set: { 'metadata.status': 'refunded' } },
        { new: true, session }
      );
      if (!reservation) return;
      await applyCreditChange({
        userId,
        amount: 1,
        reason: 'AI generation reservation refund',
        source: 'generation',
        metadata: { reservationId: String(reservation._id), status: 'refund' },
        session
      });
    });
  } finally {
    await session.endSession();
  }
}

export async function reconcilePendingGenerationReservations({
  olderThanMs = 30 * 60 * 1000,
  batchSize = 100,
  now = new Date()
} = {}) {
  const cutoff = new Date(now.getTime() - olderThanMs);
  return reconcileReservations({
    cutoff,
    batchSize,
    findPending: ({ cutoff: reservationCutoff, batchSize: limit }) => CreditTransaction.find({
      source: 'generation',
      'metadata.status': 'reserved',
      createdAt: { $lt: reservationCutoff }
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .select('_id userId')
      .lean(),
    refund: (reservation) => refundGenerationReservation({
      userId: reservation.userId,
      reservationId: reservation._id
    })
  });
}
