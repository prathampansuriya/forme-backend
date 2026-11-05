import { renderMasterEmailLayout } from './emailLayout.js';
import env from '../config/env.config.js';

const clientUrl = env.CLIENT_URL || 'http://localhost:5173';

/**
 * 1. Registration OTP
 */
export const registrationOtpTemplate = ({ name = 'Valued Clientele', otp }) => {
  const contentHtml = `
    <p>Dear ${name},</p>
    <p>We welcome you to FORME. To verify your identity and activate your bespoke customer profile, please enter the exclusive one-time passcode below:</p>
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <div style="display: inline-block; background-color: #FAF8F5; border: 1px solid #C5A880; padding: 18px 36px; border-radius: 2px;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.35em; color: #121212;">
              ${otp}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <p style="font-size: 12px; color: #78716C; text-align: center; margin: 0;">
      This authentication code expires in <strong>10 minutes</strong>. Never share this code with anyone.
    </p>
  `;

  return {
    subject: 'Verify Your FORME Identity — One-Time Passcode',
    html: renderMasterEmailLayout({
      preheader: `Your FORME authentication passcode is ${otp}`,
      heading: 'Identity Verification',
      subtitle: 'Complete your registration to access curated couture',
      badge: 'Security Authentication',
      contentHtml,
      ctaLabel: 'Enter Verification Code',
      ctaUrl: `${clientUrl}/verify-email`,
      ctaSubtext: 'Or return to your open browser tab to complete verification.',
    }),
    text: `Welcome to FORME, ${name}. Your one-time verification passcode is: ${otp}. It expires in 10 minutes.`,
  };
};

/**
 * 2. Resend OTP
 */
export const resendOtpTemplate = ({ name = 'Valued Clientele', otp }) => {
  const contentHtml = `
    <p>Dear ${name},</p>
    <p>As requested, we have generated a fresh authentication passcode for your FORME account. Any previous codes have been invalidated.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <div style="display: inline-block; background-color: #FAF8F5; border: 1px solid #C5A880; padding: 18px 36px; border-radius: 2px;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.35em; color: #121212;">
              ${otp}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <p style="font-size: 12px; color: #78716C; text-align: center; margin: 0;">
      This code is valid for <strong>10 minutes</strong>. If you did not request this, please secure your account immediately.
    </p>
  `;

  return {
    subject: 'Fresh Verification Passcode — FORME',
    html: renderMasterEmailLayout({
      preheader: `Your new FORME authentication code is ${otp}`,
      heading: 'New Authentication Code',
      subtitle: 'Dispatched per your security request',
      badge: 'Passcode Resend',
      contentHtml,
      ctaLabel: 'Verify Account',
      ctaUrl: `${clientUrl}/verify-email`,
    }),
    text: `Dear ${name}, your new FORME verification code is: ${otp}. Valid for 10 minutes.`,
  };
};

/**
 * 3. Welcome Email
 */
export const welcomeTemplate = ({ name = 'Valued Clientele' }) => {
  const contentHtml = `
    <p>Dear ${name},</p>
    <p>We are delighted to welcome you into the private world of <strong>FORME</strong>.</p>
    <p>Our philosophy is uncompromising: meticulous tailoring, architectural drape, and garments designed to withstand the test of time and trends. Every silhouette in our collection is an ode to understated contemporary luxury.</p>

    <div style="background-color: #FAF8F5; border-left: 2px solid #C5A880; padding: 16px 20px; margin: 24px 0;">
      <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 14px; font-weight: 600; color: #121212; margin-bottom: 4px;">
        Exclusive Clientele Privileges:
      </div>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #57534E; line-height: 22px;">
        <li>Priority access to seasonal capsule drops & private runways</li>
        <li>Complimentary white-glove shipping on select couture pieces</li>
        <li>Bespoke alterations and fit consultation concierge</li>
      </ul>
    </div>

    <p>Your member portfolio is now active. We invite you to explore the latest collection.</p>
  `;

  return {
    subject: 'Welcome to FORME — Designed to Be Worn',
    html: renderMasterEmailLayout({
      preheader: 'Welcome to the world of FORME contemporary fashion',
      heading: 'Welcome to the Maison',
      subtitle: 'Your customer membership has been formally confirmed',
      badge: 'New Membership',
      contentHtml,
      ctaLabel: 'Discover Current Collection',
      ctaUrl: `${clientUrl}/shop`,
    }),
    text: `Welcome to FORME, ${name}. Your membership is confirmed. Explore the collection at: ${clientUrl}/shop`,
  };
};

/**
 * 4. Forgot Password
 */
export const forgotPasswordTemplate = ({ name = 'Valued Clientele', resetUrl }) => {
  const contentHtml = `
    <p>Dear ${name},</p>
    <p>We received a formal request to reset the security credentials for your FORME account.</p>
    <p>To establish a new password, please select the button below. For your protection, this secure link is valid for <strong>15 minutes</strong> and can only be utilized once.</p>
    
    <p style="font-size: 12px; color: #78716C; margin-top: 24px;">
      If you did not initiate this request, you may safely disregard this correspondence. Your existing credentials remain completely secure.
    </p>
  `;

  return {
    subject: 'Reset Your Security Credentials — FORME',
    html: renderMasterEmailLayout({
      preheader: 'Secure link to reset your FORME account password',
      heading: 'Password Reset Request',
      subtitle: 'Authorized access recovery for your clientele account',
      badge: 'Security Notice',
      contentHtml,
      ctaLabel: 'Set New Password',
      ctaUrl: resetUrl,
      ctaSubtext: 'This link will expire automatically in 15 minutes.',
    }),
    text: `Dear ${name}, reset your FORME password using this link: ${resetUrl}. Valid for 15 minutes.`,
  };
};

/**
 * 5. Password Reset Confirmation
 */
export const passwordResetConfirmationTemplate = ({ name = 'Valued Clientele' }) => {
  const contentHtml = `
    <p>Dear ${name},</p>
    <p>This correspondence confirms that the password for your FORME account was successfully updated.</p>
    <p>All previous authentication sessions have been terminated. You may now sign in using your new credentials.</p>

    <div style="background-color: #FAF8F5; border: 1px solid #E7E5E4; padding: 14px 20px; margin: 20px 0; font-size: 12px; color: #78716C;">
      <strong>Security Advisory:</strong> If you did not perform this modification, please contact our Security Concierge immediately at <a href="mailto:security@forme.store" style="color: #121212;">security@forme.store</a>.
    </div>
  `;

  return {
    subject: 'Password Successfully Updated — FORME',
    html: renderMasterEmailLayout({
      preheader: 'Your FORME account password was successfully reset',
      heading: 'Password Updated',
      subtitle: 'Your security profile has been updated',
      badge: 'Account Security',
      contentHtml,
      ctaLabel: 'Sign In to Account',
      ctaUrl: `${clientUrl}/login`,
    }),
    text: `Dear ${name}, your FORME account password has been successfully updated.`,
  };
};

/**
 * 6. Password Changed Security Alert
 */
export const passwordChangedAlertTemplate = ({
  name = 'Valued Clientele',
  ipAddress = 'Unknown',
  deviceInfo = 'Standard Web Browser',
  changeTime = new Date().toUTCString(),
}) => {
  const contentHtml = `
    <p>Dear ${name},</p>
    <p>We are notifying you that the password for your FORME account was changed on <strong>${changeTime}</strong>.</p>
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border: 1px solid #E7E5E4; margin: 20px 0; font-size: 13px;">
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C; width: 35%;">IP Address</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-family: monospace;">${ipAddress}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; color: #78716C;">Device / Client</td>
        <td style="padding: 10px 16px; color: #121212;">${deviceInfo}</td>
      </tr>
    </table>

    <p style="font-size: 12px; color: #B91C1C;">
      If you did not authorize this change, please lock your account and contact our concierge team at once.
    </p>
  `;

  return {
    subject: 'Security Alert: Password Changed — FORME',
    html: renderMasterEmailLayout({
      preheader: 'Important security notification regarding your FORME password',
      heading: 'Security Alert',
      subtitle: 'Password modification registered on your account',
      badge: 'Security Warning',
      contentHtml,
      ctaLabel: 'Review Account Activity',
      ctaUrl: `${clientUrl}/account/security`,
    }),
    text: `Security Alert: Your FORME password was changed from IP: ${ipAddress} at ${changeTime}.`,
  };
};

/**
 * 7. New Login / Security Notification
 */
export const newLoginAlertTemplate = ({
  name = 'Valued Clientele',
  ipAddress = 'Unknown',
  deviceInfo = 'Web Session',
  loginTime = new Date().toUTCString(),
}) => {
  const contentHtml = `
    <p>Dear ${name},</p>
    <p>We noticed a new sign-in to your FORME account from a device or location not previously recognized.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border: 1px solid #E7E5E4; margin: 20px 0; font-size: 13px;">
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C; width: 35%;">Time (UTC)</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212;">${loginTime}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #78716C;">IP Address</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #E7E5E4; color: #121212; font-family: monospace;">${ipAddress}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; color: #78716C;">Client Agent</td>
        <td style="padding: 10px 16px; color: #121212;">${deviceInfo}</td>
      </tr>
    </table>

    <p style="font-size: 12px; color: #78716C;">
      If this was you, no action is required. If you do not recognize this activity, please terminate all sessions and change your password.
    </p>
  `;

  return {
    subject: 'New Sign-In Detected — FORME',
    html: renderMasterEmailLayout({
      preheader: `New sign-in to your FORME account from ${ipAddress}`,
      heading: 'New Sign-In Detected',
      subtitle: 'Security verification for your clientele session',
      badge: 'Account Activity',
      contentHtml,
      ctaLabel: 'Manage Active Sessions',
      ctaUrl: `${clientUrl}/account/security`,
    }),
    text: `New sign-in detected for your FORME account from IP ${ipAddress} at ${loginTime}.`,
  };
};

export default {
  registrationOtpTemplate,
  resendOtpTemplate,
  welcomeTemplate,
  forgotPasswordTemplate,
  passwordResetConfirmationTemplate,
  passwordChangedAlertTemplate,
  newLoginAlertTemplate,
};

