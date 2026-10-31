import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { sendOtpEmail } from '../utils/sendEmail.js';

const router = express.Router();
const makeToken = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

// Send 6-digit OTP (purpose: signup | reset)
router.post('/send-otp', async (req, res) => {
  try {
    const { email, name, purpose } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    const existing = await User.findOne({ email });
    if (purpose === 'signup' && existing)
      return res.status(400).json({ success: false, error: 'This email already registered, please login' });
    if (purpose === 'reset' && !existing)
      return res.status(400).json({ success: false, error: "This email doesn't exist, please register first" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.deleteMany({ email, purpose });
    await Otp.create({ email, otp, purpose });
    await sendOtpEmail(email, otp, purpose, name);
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Register with OTP verification
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;
    if (!name || !email || !password || !otp)
      return res.status(400).json({ success: false, error: 'All fields are required' });
    if (await User.findOne({ email }))
      return res.status(400).json({ success: false, error: 'This email already registered, please login' });
    const rec = await Otp.findOne({ email, purpose: 'signup' });
    if (!rec || rec.otp !== otp)
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
    await Otp.deleteMany({ email, purpose: 'signup' });
    const hash = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hash });
    res.json({ success: true, message: 'Successfully registered! Please login.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Login with specific errors
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, error: "This email doesn't exist, please register first" });
    if (!(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    const token = makeToken(user);
    res.json({ success: true, token, user: { name: user.name, email: user.email, credits: user.credits } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Reset password with OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ success: false, error: 'All fields are required' });
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, error: "This email doesn't exist, please register first" });
    const rec = await Otp.findOne({ email, purpose: 'reset' });
    if (!rec || rec.otp !== otp)
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
    await Otp.deleteMany({ email, purpose: 'reset' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password reset successfully! Please login.' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

export default router;
