import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import CreditTransaction from '../models/CreditTransaction.js';
import AdminBootstrap from '../models/AdminBootstrap.js';

async function bootstrapAdmin() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = String(process.env.ADMIN_NAME || 'Platform Administrator').trim();

  if (!mongoUri) throw new Error('MONGO_URI is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL must be a valid email address.');
  if (password.length < 16 || password.length > 128) throw new Error('ADMIN_PASSWORD must be between 16 and 128 characters.');
  if (name.length < 1 || name.length > 80) throw new Error('ADMIN_NAME must be between 1 and 80 characters.');

  await mongoose.connect(mongoUri);
  await Promise.all([User.init(), CreditTransaction.init(), AdminBootstrap.init()]);
  const passwordHash = await bcrypt.hash(password, 12);
  const session = await mongoose.startSession();
  let outcome = 'promoted';
  try {
    await session.withTransaction(async () => {
      const existingAdmin = await User.findOne({ role: 'Admin' }).select('_id').session(session);
      if (existingAdmin) throw new Error('An administrator already exists; bootstrap is a one-time operation.');

      const existingUser = await User.findOne({ email }).session(session);
      if (existingUser) {
        existingUser.name = name;
        existingUser.password = passwordHash;
        existingUser.role = 'Admin';
        existingUser.isActive = true;
        existingUser.refreshTokenHash = null;
        existingUser.tokenVersion = Number(existingUser.tokenVersion || 0) + 1;
        await existingUser.save({ session });
        outcome = 'promoted';
      } else {
        const [admin] = await User.create([{
          name, email, password: passwordHash, role: 'Admin', isActive: true
        }], { session });
        await CreditTransaction.create([{
          userId: admin._id,
          amount: admin.credits,
          balanceAfter: admin.credits,
          reason: 'Admin account bootstrap',
          source: 'admin'
        }], { session });
        outcome = 'created';
      }
      const admin = await User.findOne({ email }).select('_id').session(session);
      await AdminBootstrap.create([{ key: 'initial-admin', adminId: admin._id }], { session });
    });
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
  return outcome;
}

bootstrapAdmin()
  .then((outcome) => {
    console.info(JSON.stringify({ level: 'info', event: 'admin_bootstrap_complete', outcome }));
  })
  .catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'admin_bootstrap_failed', error: error.message }));
    process.exitCode = 1;
  });
