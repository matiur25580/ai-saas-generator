import mongoose from 'mongoose';

const rateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  hits: { type: Number, required: true, min: 0 },
  resetTime: { type: Date, required: true }
}, { versionKey: false });

rateLimitSchema.index({ resetTime: 1 }, { expireAfterSeconds: 0 });
export default mongoose.models.RateLimit || mongoose.model('RateLimit', rateLimitSchema);
