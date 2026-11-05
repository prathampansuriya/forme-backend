import nodemailer from 'nodemailer';
import BaseEmailProvider from './BaseEmailProvider.js';
import env from '../../config/env.config.js';

export class NodemailerProvider extends BaseEmailProvider {
  constructor(config = {}) {
    super('NODEMAILER');
    this.config = config;
    this.transporter = null;
    this._initTransporter();
  }

  _initTransporter() {
    const host = this.config.host || env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(this.config.port || env.SMTP_PORT) || 587;
    const user = this.config.user || env.SMTP_USER;
    const pass = this.config.pass || env.SMTP_PASS;
    // Port 465 is SSL direct, 587 is STARTTLS
    const secure = port === 465 ? true : Boolean(this.config.secure ?? env.SMTP_SECURE);

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
    } else {
      // Ethereal / Stream fallback for test environments without real credentials
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows',
      });
    }
  }

  async send({
    to,
    subject,
    html,
    text,
    fromName = env.EMAIL_FROM_NAME || 'FORME',
    fromEmail = env.EMAIL_FROM_ADDRESS || 'concierge@forme.store',
    replyTo,
    attachments = [],
  }) {
    if (!this.transporter) {
      this._initTransporter();
    }

    const recipientList = Array.isArray(to) ? to.join(', ') : to;

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientList,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim(),
      attachments,
    };

    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    const info = await this.transporter.sendMail(mailOptions);

    return {
      messageId: info.messageId || `nodemailer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      provider: this.name,
      raw: info,
    };
  }

  async verifyConnection() {
    const start = Date.now();
    try {
      if (!this.transporter) {
        this._initTransporter();
      }
      await this.transporter.verify();
      return {
        ok: true,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }
}

export default NodemailerProvider;

