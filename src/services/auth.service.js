import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/prisma.config.js';
import env from '../config/env.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import tokenService from './token.service.js';
import otpService from './otp.service.js';
import emailService from './email.service.js';
import googleAuthClient from '../config/google.config.js';

class AuthService {
  /**
   * Registers a new customer with unverified email and dispatches OTP.
   */
  async registerCustomer({ name, email, password }) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check for existing account
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (existingUser.isEmailVerified) {
        throw ApplicationError.conflict('An account with this email address is already registered. Please sign in.');
      }

      // If user exists but is unverified, update credentials and re-dispatch fresh OTP
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: name.trim(),
          passwordHash,
        },
      });

      await otpService.generateAndSendOTP(normalizedEmail, 'REGISTRATION', name.trim(), existingUser.id);

      return {
        requiresVerification: true,
        email: normalizedEmail,
        message: 'Account pending verification. A fresh authentication code has been sent to your email.',
      };
    }

    // 2. Hash password securely (12 rounds)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Create unverified customer in database
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'CUSTOMER',
        isEmailVerified: false,
        authProvider: 'LOCAL',
        status: 'ACTIVE',
        notificationPreferences: {
          create: {
            emailOrderUpdates: true,
            emailPromotions: true,
            emailStockAlerts: true,
          },
        },
      },
    });

    // 4. Generate and send cryptographically secure OTP
    await otpService.generateAndSendOTP(normalizedEmail, 'REGISTRATION', name.trim(), user.id);

    return {
      requiresVerification: true,
      email: normalizedEmail,
      message: 'Account created. Please verify your email with the 6-digit code sent to your inbox.',
    };
  }

  /**
   * Verifies registration OTP, marks email verified, issues JWTs.
   */
  async verifyEmailOTP({ email, otp, deviceInfo, ipAddress }) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw ApplicationError.notFound('Account not found for this email address.');
    }

    if (user.isEmailVerified) {
      // Already verified, generate tokens
      const tokens = await tokenService.generateTokens(user, deviceInfo, ipAddress);
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          isEmailVerified: true,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }

    // Validate OTP hash and consume
    await otpService.verifyOTP(normalizedEmail, otp, 'REGISTRATION');

    // Update user status to verified
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isEmailVerified: true,
      },
    });

    // Issue authentication tokens
    const tokens = await tokenService.generateTokens(updatedUser, deviceInfo, ipAddress);

    // Send welcome correspondence asynchronously
    emailService.sendWelcomeEmail(updatedUser.email, updatedUser.name).catch((err) => {
      console.error('[AUTH SERVICE] Non-blocking welcome email failed:', err.message);
    });

    return {
      user: updatedUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Resends fresh OTP for registration or verification.
   */
  async resendOTP({ email, purpose = 'REGISTRATION' }) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw ApplicationError.notFound('No account associated with this email address.');
    }

    if (purpose === 'REGISTRATION' && user.isEmailVerified) {
      throw ApplicationError.badRequest('Your email address is already verified. Please proceed to login.');
    }

    await otpService.generateAndSendOTP(normalizedEmail, purpose, user.name || 'Customer', user.id);

    return {
      message: 'A fresh verification code has been dispatched to your email address.',
    };
  }

  /**
   * Customer login with email & password.
   */
  async loginCustomer({ email, password, deviceInfo, ipAddress }) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.role !== 'CUSTOMER' || user.deletedAt) {
      throw ApplicationError.unauthorized('Invalid email or password.');
    }

    if (!user.passwordHash) {
      throw ApplicationError.badRequest('This account was created via Google Sign-In. Please use Google Sign-In to access your account.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw ApplicationError.unauthorized('Invalid email or password.');
    }

    if (user.status !== 'ACTIVE') {
      throw ApplicationError.forbidden('Your account is currently suspended. Please contact concierge@forme.store.');
    }

    // If not verified, trigger OTP and prompt user
    if (!user.isEmailVerified) {
      await otpService.generateAndSendOTP(normalizedEmail, 'REGISTRATION', user.name || 'Customer', user.id);
      return {
        requiresVerification: true,
        email: user.email,
        message: 'Your email address has not been verified yet. A fresh verification code has been dispatched.',
      };
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Issue tokens
    const tokens = await tokenService.generateTokens(user, deviceInfo, ipAddress);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Dedicated Admin login (Role strictly enforced: ADMIN).
   */
  async loginAdmin({ email, password, deviceInfo, ipAddress }) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Strict security check: reject if not admin or not found
    if (!user || user.role !== 'ADMIN' || user.deletedAt) {
      throw ApplicationError.unauthorized('Access denied. Valid administrative credentials required.');
    }

    if (!user.passwordHash) {
      throw ApplicationError.unauthorized('Invalid administrative credentials.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw ApplicationError.unauthorized('Invalid administrative credentials.');
    }

    if (user.status !== 'ACTIVE') {
      throw ApplicationError.forbidden('Administrative account is currently suspended.');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Issue tokens
    const tokens = await tokenService.generateTokens(user, deviceInfo, ipAddress);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Google OAuth 2.0 Sign-In using verified Google ID token.
   */
  async loginWithGoogle({ credential, deviceInfo, ipAddress }) {
    if (!credential) {
      throw ApplicationError.badRequest('Google ID token credential is required.');
    }

    let payload;
    try {
      const ticket = await googleAuthClient.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('[GOOGLE AUTH ERROR]', err.message);
      throw ApplicationError.unauthorized('Failed to verify Google identity credential.');
    }

    if (!payload || !payload.email) {
      throw ApplicationError.unauthorized('Google token payload did not contain a valid email address.');
    }

    if (!payload.email_verified) {
      throw ApplicationError.badRequest('Google account email has not been verified by Google.');
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const name = payload.name || `${payload.given_name || 'Customer'} ${payload.family_name || ''}`.trim();
    const avatarUrl = payload.picture || null;

    // Check if user exists by googleId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (user) {
      // If user exists with email but not googleId, link account
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            authProvider: user.authProvider === 'LOCAL' ? 'LOCAL' : 'GOOGLE',
            isEmailVerified: true,
            avatarUrl: user.avatarUrl || avatarUrl,
            lastLoginAt: new Date(),
          },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            avatarUrl: user.avatarUrl || avatarUrl,
          },
        });
      }

      // Ensure OAuthAccount record exists
      await prisma.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'GOOGLE',
            providerAccountId: googleId,
          },
        },
        update: { updatedAt: new Date() },
        create: {
          userId: user.id,
          provider: 'GOOGLE',
          providerAccountId: googleId,
        },
      });
    } else {
      // Create new customer account via Google
      user = await prisma.user.create({
        data: {
          name,
          email,
          googleId,
          role: 'CUSTOMER',
          isEmailVerified: true,
          authProvider: 'GOOGLE',
          status: 'ACTIVE',
          avatarUrl,
          lastLoginAt: new Date(),
          oauthAccounts: {
            create: {
              provider: 'GOOGLE',
              providerAccountId: googleId,
            },
          },
          notificationPreferences: {
            create: {
              emailOrderUpdates: true,
              emailPromotions: true,
              emailStockAlerts: true,
            },
          },
        },
      });
    }

    if (user.status !== 'ACTIVE') {
      throw ApplicationError.forbidden('Your account is currently suspended.');
    }

    // Issue tokens
    const tokens = await tokenService.generateTokens(user, deviceInfo, ipAddress);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: true,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Initiates forgot-password workflow and dispatches password reset email.
   */
  async forgotPassword({ email }) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user && user.status === 'ACTIVE' && !user.deletedAt) {
      // 1. Invalidate any active previous reset tokens
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          isUsed: false,
        },
        data: { isUsed: true },
      });

      // 2. Generate cryptographically secure random token (32 bytes = 64 hex chars)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

      // 3. Store hashed token in database
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          isUsed: false,
        },
      });

      // 4. Construct reset link and dispatch email
      const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;
      await emailService.sendPasswordResetEmail(normalizedEmail, user.name || 'Customer', resetUrl);
    }

    // Generic response to prevent account enumeration
    return {
      message: 'If an account exists with this email address, password reset instructions have been dispatched.',
    };
  }

  /**
   * Resets password using valid token.
   */
  async resetPassword({ email, token, newPassword }) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw ApplicationError.badRequest('Invalid or expired password reset link.');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find active non-expired reset token
    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) {
      throw ApplicationError.badRequest('Invalid or expired password reset link. Please request a new link.');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password and consume token inside atomic transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { isUsed: true },
      }),
    ]);

    // Invalidate all active sessions for security
    await tokenService.revokeAllUserSessions(user.id);

    return {
      message: 'Your password has been successfully updated. Please sign in with your new credentials.',
    };
  }

  /**
   * Changes password for an authenticated user.
   */
  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApplicationError.notFound('User account not found.');
    }

    if (!user.passwordHash) {
      throw ApplicationError.badRequest('This account does not have a local password configured (OAuth profile).');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw ApplicationError.badRequest('The current password provided is incorrect.');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      message: 'Your password has been changed successfully.',
    };
  }

  /**
   * Updates customer profile details (name, phone, avatarUrl).
   */
  async updateProfile({ userId, name, phone, avatarUrl }) {
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (avatarUrl !== undefined) {
      dataToUpdate.avatarUrl = avatarUrl ? avatarUrl.trim() : null;
    }
    if (phone !== undefined) {
      // Check for phone uniqueness
      if (phone) {
        const existingWithPhone = await prisma.user.findFirst({
          where: {
            phone: phone.trim(),
            id: { not: userId },
          },
        });
        if (existingWithPhone) {
          throw ApplicationError.conflict('This phone number is already linked to another account.');
        }
      }
      dataToUpdate.phone = phone ? phone.trim() : null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        isEmailVerified: true,
      },
    });

    return updatedUser;
  }

  /**
   * Retrieves full profile for authenticated user.
   */
  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        isEmailVerified: true,
        authProvider: true,
        status: true,
        createdAt: true,
        addresses: {
          orderBy: { isDefaultShipping: 'desc' },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!user) {
      throw ApplicationError.notFound('User profile not found.');
    }

    return user;
  }
}

export const authService = new AuthService();
export default authService;

