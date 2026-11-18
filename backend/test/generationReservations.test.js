import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileReservations } from '../utils/generationReservations.js';

test('reconciles each stale reservation and reports the outcome', async () => {
  const reservations = [{ _id: 'a' }, { _id: 'b' }];
  const refunded = [];
  const result = await reconcileReservations({
    cutoff: new Date('2026-01-01T00:00:00.000Z'),
    batchSize: 25,
    findPending: async ({ cutoff, batchSize }) => {
      assert.equal(cutoff.toISOString(), '2026-01-01T00:00:00.000Z');
      assert.equal(batchSize, 25);
      return reservations;
    },
    refund: async (reservation) => refunded.push(reservation._id)
  });

  assert.deepEqual(refunded, ['a', 'b']);
  assert.deepEqual(result, { scanned: 2, refunded: 2, skipped: 0 });
});

test('continues processing when one reservation refund fails', async () => {
  const refunded = [];
  const result = await reconcileReservations({
    cutoff: new Date(),
    findPending: async () => [{ _id: 'failed' }, { _id: 'succeeded' }],
    refund: async (reservation) => {
      if (reservation._id === 'failed') throw new Error('Transient database failure');
      refunded.push(reservation._id);
    }
  });

  assert.deepEqual(refunded, ['succeeded']);
  assert.deepEqual(result, { scanned: 2, refunded: 1, skipped: 1 });
});

test('rejects invalid batch sizes before querying reservations', async () => {
  let queried = false;
  await assert.rejects(
    reconcileReservations({
      cutoff: new Date(),
      batchSize: 0,
      findPending: async () => { queried = true; return []; },
      refund: async () => {}
    }),
    RangeError
  );
  assert.equal(queried, false);
});

test('requires a valid cutoff date', async () => {
  await assert.rejects(
    reconcileReservations({
      cutoff: new Date('invalid'),
      findPending: async () => [],
      refund: async () => {}
    }),
    TypeError
  );
});

test('counts a reservation already settled by another worker as skipped', async () => {
  const result = await reconcileReservations({
    cutoff: new Date(),
    findPending: async () => [{ _id: 'already-completed' }],
    refund: async () => false
  });

  assert.deepEqual(result, { scanned: 1, refunded: 0, skipped: 1 });
});
