import nodemailer from 'nodemailer';
import env from './env.config.js';

let transporter = null;

export const getEmailTransporter = async () => {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const port = Number(env.SMTP_PORT) || 587;
    // Port 465 uses SSL/TLS direct, Port 587 uses STARTTLS (secure = false)
    const secure = port === 465 ? true : Boolean(env.SMTP_SECURE);

    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
  } else {
    // Development fallback to Ethereal test account if credentials are not specified
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[FORME EMAIL] Created test Ethereal inbox: ${testAccount.user}`);
  }

  return transporter;
};

export default getEmailTransporter;

