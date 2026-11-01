import mongoose from 'mongoose';
export default mongoose.model('Content', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  prompt: { type: String, required: true, maxlength: 5000 },
  response: { type: String, required: true, maxlength: 30000 },
  persona: { type: String, maxlength: 80 },
  tone: { type: String, maxlength: 40 },
  contentType: { type: String, maxlength: 80 },
  outputLength: { type: String, enum: ['Short', 'Medium', 'Long'] },
  bookmarked: { type: Boolean, default: false }
}, { timestamps: true }).index({ userId: 1, createdAt: -1 }));
