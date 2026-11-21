import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Compare-and-swap the stored refresh-token hash. Only one concurrent request
// presenting the same token can rotate the session successfully.
export async function rotateRefreshSession({ userModel, userId, currentRefreshToken, secret, tokenVersion = 0 }) {
  const refreshToken = jwt.sign({
    id: String(userId), type: 'refresh', jti: randomUUID(), ver: tokenVersion
  }, secret, { expiresIn: '7d' });
  const versionCriteria = tokenVersion === 0
    ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
    : { tokenVersion };
  const user = await userModel.findOneAndUpdate(
    {
      _id: userId,
      refreshTokenHash: hashToken(currentRefreshToken),
      isActive: { $ne: false },
      ...versionCriteria
    },
    { $set: { refreshTokenHash: hashToken(refreshToken), tokenVersion } },
    { new: true }
  );
  if (!user) return null;

  const currentVersion = Number(user.tokenVersion ?? tokenVersion);
  const accessToken = jwt.sign({
    id: String(userId), type: 'access', ver: currentVersion
  }, secret, { expiresIn: '15m' });
  return { user, accessToken, refreshToken };
}
