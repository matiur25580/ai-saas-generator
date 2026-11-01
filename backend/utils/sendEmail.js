export async function sendOtpEmail(email, otp, purpose, name = '') {
  const isSignup = purpose === 'signup';
  const subject = isSignup ? 'Verify your email - AI SaaS Generator' : 'Reset your password - AI SaaS Generator';
  const safeName = String(name || 'there').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const title = isSignup ? `Hi ${safeName}, verify your email` : 'Password reset request';
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#fff;padding:32px;border-radius:12px">
      <h2 style="color:#22d3ee">AI SaaS Generator</h2>
      <h3>${title}</h3>
      <p>Your 6-digit verification code (valid 3 minutes):</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#1e293b;padding:16px;border-radius:8px;text-align:center;color:#22d3ee">${otp}</div>
      <p style="color:#94a3b8;font-size:12px">If you didn't request this, ignore this email.</p>
    </div>`;
  if (!process.env.BREVO_API_KEY) {
    const error = new Error('Email delivery is not configured. Please contact support.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER;
  if (!senderEmail) {
    const error = new Error('Email sender is not configured. Please contact support.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: 'AI SaaS Generator' },
      to: [{ email }],
      subject,
      htmlContent: html
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const error = new Error('We could not send the email right now. Please try again later.');
    error.code = 'EMAIL_DELIVERY_FAILED';
    console.error('Brevo email request failed with status', response.status);
    throw error;
  }
  return true;
}
