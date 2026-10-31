import mongoose from 'mongoose';
export default mongoose.model('Content', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  prompt: String, response: String, persona: String, tone: String,
  bookmarked: { type: Boolean, default: false }
}, { timestamps: true }));
