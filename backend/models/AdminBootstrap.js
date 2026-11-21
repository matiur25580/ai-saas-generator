import mongoose from 'mongoose';

const adminBootstrapSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });

export default mongoose.models.AdminBootstrap || mongoose.model('AdminBootstrap', adminBootstrapSchema);
