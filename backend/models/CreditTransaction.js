import mongoose from 'mongoose';

const creditTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  reason: { type: String, required: true, maxlength: 160 },
  source: { type: String, enum: ['generation', 'admin'], required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

creditTransactionSchema.index({ userId: 1, createdAt: -1 });
export default mongoose.model('CreditTransaction', creditTransactionSchema);