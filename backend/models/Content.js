import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  persona: { type: String },
  aiTone: { type: String },
  response: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toLocaleString() }
});

export default mongoose.model('Content', contentSchema);
