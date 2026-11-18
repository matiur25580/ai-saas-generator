import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../models/User.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { applyCreditChange, refundGenerationReservation, reconcilePendingGenerationReservations } from '../utils/credits.js';

const mongoUri = process.env.MONGODB_TEST_URI;
const enabled = Boolean(mongoUri);

before(async () => {
  if (enabled) await mongoose.connect(mongoUri);
});

after(async () => {
  if (enabled && mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

async function createUser(credits) {
  return User.create({
    name: 'Credit integration test',
    email: `credit-test-${new mongoose.Types.ObjectId()}@example.test`,
    password: 'not-a-real-password',
    credits
  });
}

async function reserveCredit(userId) {
  const session = await mongoose.startSession();
  let reservation;
  try {
    await session.withTransaction(async () => {
      reservation = await applyCreditChange({
        userId,
        amount: -1,
        reason: 'Integration test reservation',
        source: 'generation',
        metadata: { status: 'reserved' },
        session,
        includeTransaction: true
      });
    });
  } finally {
    await session.endSession();
  }
  return reservation.transaction;
}

test('reservation and refund are atomic and duplicate refunds are idempotent', { skip: !enabled }, async () => {
  const user = await createUser(1);
  const reservation = await reserveCredit(user._id);

  assert.equal((await User.findById(user._id)).credits, 0);
  const refundResults = await Promise.all([
    refundGenerationReservation({ userId: user._id, reservationId: reservation._id }),
    refundGenerationReservation({ userId: user._id, reservationId: reservation._id })
  ]);
  assert.equal(refundResults.filter(Boolean).length, 1);
  assert.equal(refundResults.filter((result) => result === false).length, 1);
  assert.equal((await User.findById(user._id)).credits, 1);

  const storedReservation = await CreditTransaction.findById(reservation._id);
  assert.equal(storedReservation.metadata.status, 'refunded');
  assert.equal(await CreditTransaction.countDocuments({
    userId: user._id,
    'metadata.status': 'refund'
  }), 1);
});

test('concurrent reservations cannot spend the same final credit', { skip: !enabled }, async () => {
  const user = await createUser(1);
  const attempts = await Promise.allSettled([
    reserveCredit(user._id),
    reserveCredit(user._id)
  ]);

  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);
  assert.equal((await User.findById(user._id)).credits, 0);
  assert.equal(await CreditTransaction.countDocuments({
    userId: user._id,
    amount: -1,
    'metadata.status': 'reserved'
  }), 1);
});

test('reconciliation refunds only reservations older than the configured cutoff', { skip: !enabled }, async () => {
  const user = await createUser(2);
  const oldReservation = await reserveCredit(user._id);
  const recentReservation = await reserveCredit(user._id);
  const now = new Date();
  await CreditTransaction.collection.updateOne(
    { _id: oldReservation._id },
    { $set: { createdAt: new Date(now.getTime() - 60 * 60 * 1000) } }
  );

  const result = await reconcilePendingGenerationReservations({
    olderThanMs: 30 * 60 * 1000,
    now
  });

  assert.ok(result.scanned >= 1, 'the stale reservation should be discovered');
  assert.ok(result.refunded >= 1, 'the stale reservation should be refunded');
  assert.equal((await CreditTransaction.findById(oldReservation._id)).metadata.status, 'refunded');
  assert.equal((await CreditTransaction.findById(recentReservation._id)).metadata.status, 'reserved');
  assert.equal((await User.findById(user._id)).credits, 1);
});
