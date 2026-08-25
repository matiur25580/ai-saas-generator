const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    credits: { type: Number, default: 10 },
    history: [
        {
            prompt: String,
            response: String,
            date: { type: String, default: () => new Date().toLocaleTimeString() }
        }
    ]
});

module.exports = mongoose.model('User', userSchema);
