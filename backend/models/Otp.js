import mongoose from 'mongoose';
const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  purpose: { type: String, enum: ['signup', 'reset'] },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1 }, { unique: true });
export default mongoose.model('Otp', otpSchema);
