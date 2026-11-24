// Shared recovery routine: find stale reservations and safely attempt refunds in bounded batches.
export async function reconcileReservations({
  findPending,
  refund,
  cutoff,
  batchSize = 100
}) {
  if (typeof findPending !== 'function' || typeof refund !== 'function') {
    throw new TypeError('findPending and refund must be functions.');
  }
  if (!(cutoff instanceof Date) || Number.isNaN(cutoff.getTime())) {
    throw new TypeError('cutoff must be a valid Date.');
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new RangeError('batchSize must be an integer from 1 to 1000.');
  }

  const reservations = await findPending({ cutoff, batchSize });
  let refunded = 0;
  let skipped = 0;

  for (const reservation of reservations) {
    try {
      const wasRefunded = await refund(reservation);
      if (wasRefunded === false) skipped += 1;
      else refunded += 1;
    } catch {
      skipped += 1;
    }
  }

  return { scanned: reservations.length, refunded, skipped };
}
