import * as Brevo from '@getbrevo/brevo';
import BaseEmailProvider from './BaseEmailProvider.js';
import env from '../../config/env.config.js';

export class BrevoProvider extends BaseEmailProvider {
  constructor(apiKey = null) {
    super('BREVO');
    this.apiKey = apiKey || env.BREVO_API_KEY;
    this.apiInstance = null;
    this._initClient();
  }

  _initClient() {
    if (this.apiKey) {
      const api = new Brevo.TransactionalEmailsApi();
      api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, this.apiKey);
      this.apiInstance = api;
    }
  }

  async send({
    to,
    subject,
    html,
    text,
    fromName = env.BREVO_SENDER_NAME || env.EMAIL_FROM_NAME || 'FORME',
    fromEmail = env.BREVO_SENDER_EMAIL || env.EMAIL_FROM_ADDRESS || 'concierge@forme.store',
    replyTo,
    tags = [],
    params = {},
    attachments = [],
  }) {
    if (!this.apiInstance) {
      this._initClient();
    }

    if (!this.apiInstance) {
      throw new Error('Brevo API key is not configured. Unable to dispatch transactional email via Brevo.');
    }

    const recipients = Array.isArray(to)
      ? to.map((email) => ({ email: typeof email === 'string' ? email : email.email, name: email.name }))
      : [{ email: to }];

    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.textContent = text || html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    sendSmtpEmail.sender = {
      name: fromName,
      email: fromEmail,
    };
    sendSmtpEmail.to = recipients;

    if (replyTo) {
      sendSmtpEmail.replyTo = { email: replyTo };
    }

    if (tags && tags.length > 0) {
      sendSmtpEmail.tags = tags;
    }

    if (params && Object.keys(params).length > 0) {
      sendSmtpEmail.params = params;
    }

    if (attachments && attachments.length > 0) {
      // Brevo accepts attachments as [{ name, content (base64) }]
      sendSmtpEmail.attachment = attachments.map((att) => ({
        name: att.filename || att.name,
        content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
      }));
    }

    const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
    const messageId = result?.body?.messageId || result?.messageId || `brevo-${Date.now()}`;

    return {
      messageId,
      provider: this.name,
      raw: result,
    };
  }

  async verifyConnection() {
    const start = Date.now();
    try {
      if (!this.apiKey) {
        return {
          ok: false,
          latencyMs: 0,
          error: 'Brevo API key is missing.',
        };
      }
      // Check account credentials via AccountApi
      const accountApi = new Brevo.AccountApi();
      accountApi.setApiKey(Brevo.AccountApiApiKeys.apiKey, this.apiKey);
      await accountApi.getAccount();

      return {
        ok: true,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err.response?.body?.message || err.message,
      };
    }
  }
}

export default BrevoProvider;

