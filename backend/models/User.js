const mongoose = require('mongoose');
module.exports = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  credits: { type: Number, default: 50 },
  role: { type: String, default: 'User' }
}, { timestamps: true }));
