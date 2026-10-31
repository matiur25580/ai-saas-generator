import nodemailer from 'nodemailer';

export async function sendOtpEmail(email, otp, purpose, name = '') {
  const isSignup = purpose === 'signup';
  const subject = isSignup ? 'Verify your email - AI SaaS Generator' : 'Reset your password - AI SaaS Generator';
  const title = isSignup ? `Hi ${name || 'there'}, verify your email` : 'Password reset request';
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#fff;padding:32px;border-radius:12px">
      <h2 style="color:#22d3ee">🤖 AI SaaS Generator</h2>
      <h3>${title}</h3>
      <p>Your 6-digit verification code (valid 3 minutes):</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#1e293b;padding:16px;border-radius:8px;text-align:center;color:#22d3ee">${otp}</div>
      <p style="color:#94a3b8;font-size:12px">If you didn't request this, ignore this email.</p>
    </div>`;
  console.log(`📧 OTP for ${email} [${purpose}]: ${otp}`);
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('⚠️ EMAIL_USER/EMAIL_PASS not set - skipping real email');
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      connectionTimeout: 15000, socketTimeout: 15000
    });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject, html });
    console.log('✅ OTP email sent to', email);
    return true;
  } catch (e) {
    console.log('❌ EMAIL FAILED:', e.message);
    return false;
  }
}
