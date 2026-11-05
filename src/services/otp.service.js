import crypto from 'crypto';
import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import emailService from './email.service.js';

class OTPService {
  /**
   * Hashes raw OTP using SHA-256 to ensure plaintext OTP is never persisted.
   */
  hashOTP(rawOtp) {
    return crypto.createHash('sha256').update(rawOtp).digest('hex');
  }

  /**
   * Generates a cryptographically random 6-digit code, stores the hash, and dispatches email.
   */
  async generateAndSendOTP(email, purpose = 'REGISTRATION', name = 'Customer', userId = null) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Invalidate previous active OTPs for this email and purpose
    await prisma.emailOTP.updateMany({
      where: {
        email: normalizedEmail,
        purpose,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    // 2. Generate 6-digit cryptographically secure OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = this.hashOTP(rawOtp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    // 3. Persist hashed OTP in database
    await prisma.emailOTP.create({
      data: {
        email: normalizedEmail,
        otpHash,
        purpose,
        expiresAt,
        attempts: 0,
        isUsed: false,
        userId,
      },
    });

    // 4. Send email (Never log or return the raw OTP in API response)
    await emailService.sendVerificationEmail(normalizedEmail, name, rawOtp);

    return {
      message: 'Verification code dispatched to your email address.',
      expiresInMinutes: 10,
    };
  }

  /**
   * Validates submitted OTP against stored hash, enforcing maximum 3 attempts and expiry.
   */
  async verifyOTP(email, rawOtp, purpose = 'REGISTRATION') {
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedOtp = rawOtp.trim();

    // 1. Find active non-expired OTP record
    const otpRecord = await prisma.emailOTP.findFirst({
      where: {
        email: normalizedEmail,
        purpose,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw ApplicationError.badRequest('Invalid or expired verification code. Please request a new code.');
    }

    // 2. Enforce Attempt Limit (Max 3 attempts per code)
    if (otpRecord.attempts >= 3) {
      await prisma.emailOTP.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      });
      throw ApplicationError.badRequest('Maximum verification attempts exceeded. For security, please request a new code.');
    }

    // Increment attempt counter
    await prisma.emailOTP.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    // 3. Compare hashes using constant-time comparison
    const submittedHash = this.hashOTP(trimmedOtp);
    const storedHashBuffer = Buffer.from(otpRecord.otpHash, 'hex');
    const submittedHashBuffer = Buffer.from(submittedHash, 'hex');

    const isValid =
      storedHashBuffer.length === submittedHashBuffer.length &&
      crypto.timingSafeEqual(storedHashBuffer, submittedHashBuffer);

    if (!isValid) {
      const remainingAttempts = 2 - otpRecord.attempts;
      const attemptNote = remainingAttempts > 0 ? ` (${remainingAttempts} attempt(s) remaining)` : '';
      throw ApplicationError.badRequest(`Incorrect verification code. Please check and try again${attemptNote}.`);
    }

    // 4. Mark OTP consumed
    await prisma.emailOTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    return true;
  }
}

export const otpService = new OTPService();
export default otpService;

