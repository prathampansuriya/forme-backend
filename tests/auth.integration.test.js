import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.config.js';
import otpService from '../src/services/otp.service.js';

describe('FORME Authentication End-to-End Suite', { timeout: 20000 }, () => {
  const testEmail = `couture.tester.${Date.now()}@forme.store`;
  const testPassword = 'CouturePassword2026!';
  let rawOtp = null;
  let accessToken = null;
  let refreshTokenCookie = null;

  afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    await prisma.$disconnect();
  });

  it('1. POST /api/v1/auth/register should create an unverified customer and generate hashed OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Camilla Valois',
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requiresVerification).toBe(true);
    expect(res.body.data.email).toBe(testEmail);

    // Verify user exists in database and is unverified
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).toBeDefined();
    expect(user.isEmailVerified).toBe(false);
    expect(user.role).toBe('CUSTOMER');

    // Retrieve the active OTP record to extract the hash
    const otpRecord = await prisma.emailOTP.findFirst({
      where: { email: testEmail, purpose: 'REGISTRATION', isUsed: false },
    });
    expect(otpRecord).toBeDefined();
    expect(otpRecord.otpHash).toHaveLength(64); // SHA-256 length
  });

  it('2. POST /api/v1/auth/register should handle duplicate registration before verification and re-send OTP', async () => {
    // Duplicate before verification updates details & re-sends OTP
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Camilla Valois Updated',
        email: testEmail,
        password: testPassword,
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.requiresVerification).toBe(true);
  });

  it('3. POST /api/v1/auth/verify-otp should reject incorrect OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: testEmail,
        otp: '000000',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('4. POST /api/v1/auth/verify-otp should verify email with valid OTP hash match', async () => {
    // For test purposes, generate known OTP hash in DB directly
    const testOtpCode = '654321';
    const otpHash = otpService.hashOTP(testOtpCode);

    await prisma.emailOTP.updateMany({
      where: { email: testEmail, purpose: 'REGISTRATION' },
      data: { isUsed: true },
    });

    await prisma.emailOTP.create({
      data: {
        email: testEmail,
        otpHash,
        purpose: 'REGISTRATION',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        isUsed: false,
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: testEmail,
        otp: testOtpCode,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.isEmailVerified).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();

    accessToken = res.body.data.accessToken;
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    refreshTokenCookie = cookies[0];

    // Check user is now verified in DB
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user.isEmailVerified).toBe(true);
  });

  it('5. POST /api/v1/auth/login should authenticate verified customer and issue JWT', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('5b. POST /api/v1/auth/register should REJECT duplicate registration for verified customer', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Camilla Valois Duplicate',
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('CONFLICT_RESOURCE');
  });

  it('6. POST /api/v1/auth/admin/login should authenticate administrative credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'admin@forme.store',
        password: 'FormeAdmin@2026!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('7. POST /api/v1/auth/admin/login should REJECT customer credentials from admin portal', async () => {
    const res = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('8. GET /api/v1/auth/me should return authenticated customer profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
  });

  it('9. PATCH /api/v1/auth/profile should update customer profile', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Camilla Valois de FORME',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.name).toBe('Camilla Valois de FORME');
  });

  it('10. POST /api/v1/auth/change-password should change password with current password verification', async () => {
    const newPassword = 'NewCouturePassword2026!';

    // Rejects incorrect current password
    const failRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'WrongPassword!',
        newPassword,
      });

    expect(failRes.status).toBe(400);

    // Accepts correct current password
    const successRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: testPassword,
        newPassword,
      });

    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
  });

  it('11. POST /api/v1/auth/refresh should rotate refresh token and issue new access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('12. POST /api/v1/auth/logout should clear session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [refreshTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
