import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, select: false },
  refreshTokenHash: { type: String, default: null, select: false },
  tokenVersion: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  credits: { type: Number, default: 50, min: 0, validate: Number.isInteger },
  role: { type: String, enum: ['User', 'Admin'], default: 'User' }
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
export default mongoose.models.User || mongoose.model('User', userSchema);
