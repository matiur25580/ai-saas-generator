import RateLimit from '../models/RateLimit.js';

export default class MongoRateLimitStore {
  constructor({ prefix = 'rate-limit:' } = {}) {
    this.prefix = prefix;
    this.windowMs = 60_000;
  }

  init(options) {
    if (Number.isFinite(options?.windowMs) && options.windowMs > 0) this.windowMs = options.windowMs;
  }

  async increment(key) {
    const storageKey = this.prefix + String(key);
    const now = new Date();
    const nextReset = new Date(now.getTime() + this.windowMs);
    const filter = { key: storageKey };
    const update = [{
      $set: {
        hits: {
          $cond: [
            { $gt: ['$resetTime', now] },
            { $add: [{ $ifNull: ['$hits', 0] }, 1] },
            1
          ]
        },
        resetTime: {
          $cond: [
            { $gt: ['$resetTime', now] },
            '$resetTime',
            nextReset
          ]
        }
      }
    }];

    let record;
    try {
      record = await RateLimit.findOneAndUpdate(filter, update, {
        new: true, upsert: true, setDefaultsOnInsert: false
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      record = await RateLimit.findOneAndUpdate(filter, update, {
        new: true, upsert: false, setDefaultsOnInsert: false
      });
      if (!record) {
        record = await RateLimit.findOneAndUpdate(filter, update, {
          new: true, upsert: true, setDefaultsOnInsert: false
        });
      }
    }

    if (!record) throw new Error('Rate-limit counter could not be updated.');
    return { totalHits: record.hits, resetTime: record.resetTime };
  }

  async get(key) {
    const record = await RateLimit.findOne({
      key: this.prefix + String(key),
      resetTime: { $gt: new Date() }
    }).lean();
    return record ? { totalHits: record.hits, resetTime: record.resetTime } : undefined;
  }

  async decrement(key) {
    await RateLimit.updateOne(
      { key: this.prefix + String(key), hits: { $gt: 0 } },
      { $inc: { hits: -1 } }
    );
  }

  async resetKey(key) {
    await RateLimit.deleteOne({ key: this.prefix + String(key) });
  }

  async resetAll() {
    await RateLimit.deleteMany({ key: { $regex: '^' + this.prefix } });
  }
}
