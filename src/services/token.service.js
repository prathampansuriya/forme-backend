import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import jwtConfig from '../config/jwt.config.js';
import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';

class TokenService {
  /**
   * Hashes a raw refresh token using SHA-256 for secure database storage.
   */
  hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a pair of short-lived Access Token and persistent Refresh Token.
   */
  async generateTokens(user, deviceInfo = null, ipAddress = null) {
    // 1. Generate Access Token (JWT - 15 minutes)
    const accessPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(accessPayload, jwtConfig.accessSecret, {
      expiresIn: jwtConfig.accessExpiresIn,
    });

    // 2. Generate Refresh Token (Cryptographically random 64-char hex string)
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 3. Store hashed token in database
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceInfo,
        ipAddress,
        expiresAt,
        isRevoked: false,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresAt,
    };
  }

  /**
   * Rotates a refresh token: invalidates old token, verifies authenticity, detects reuse, issues fresh pair.
   */
  async rotateRefreshToken(rawOldToken, deviceInfo = null, ipAddress = null) {
    if (!rawOldToken) {
      throw ApplicationError.unauthorized('Refresh token is required.');
    }

    const tokenHash = this.hashToken(rawOldToken);

    // 1. Find token in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // 2. Automatic Reuse Detection:
    // If a revoked token is presented, someone may have compromised the token family.
    // Invalidate all active tokens for that user immediately to protect the account.
    if (storedToken && storedToken.isRevoked) {
      console.warn(`⚠️ [SECURITY ALERT] Refresh token reuse detected for user ${storedToken.userId}! Revoking all sessions.`);
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { isRevoked: true },
      });
      throw ApplicationError.unauthorized('Suspicious session activity detected. All active sessions have been terminated. Please log in again.');
    }

    if (!storedToken) {
      throw ApplicationError.unauthorized('Invalid refresh session. Please sign in again.');
    }

    if (new Date() > storedToken.expiresAt) {
      // Clean up expired token
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw ApplicationError.unauthorized('Session has expired. Please sign in again.');
    }

    const user = storedToken.user;
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      throw ApplicationError.unauthorized('The user account is no longer active.');
    }

    // 3. Invalidate old token (Rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // 4. Generate fresh token pair
    const tokens = await this.generateTokens(user, deviceInfo, ipAddress);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Revokes a single refresh token session upon logout.
   */
  async revokeRefreshToken(rawToken) {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);

    await prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  }

  /**
   * Revokes all refresh token sessions for a specific user (Logout from all devices).
   */
  async revokeAllUserSessions(userId) {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}

export const tokenService = new TokenService();
export default tokenService;

