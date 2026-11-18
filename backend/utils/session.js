import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Compare-and-swap the stored refresh-token hash. Only one concurrent request
// presenting the same token can rotate the session successfully.
export async function rotateRefreshSession({ userModel, userId, currentRefreshToken, secret }) {
  const refreshToken = jwt.sign({ id: String(userId), type: 'refresh', jti: randomUUID() }, secret, { expiresIn: '7d' });
  const user = await userModel.findOneAndUpdate(
    { _id: userId, refreshTokenHash: hashToken(currentRefreshToken) },
    { $set: { refreshTokenHash: hashToken(refreshToken) } },
    { new: true }
  );
  if (!user) return null;

  const accessToken = jwt.sign({ id: String(userId), type: 'access' }, secret, { expiresIn: '15m' });
  return { user, accessToken, refreshToken };
}
