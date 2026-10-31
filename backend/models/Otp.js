import mongoose from 'mongoose';
const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  purpose: { type: String, enum: ['signup', 'reset'] }
}, { timestamps: true });
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });
export default mongoose.model('Otp', otpSchema);
