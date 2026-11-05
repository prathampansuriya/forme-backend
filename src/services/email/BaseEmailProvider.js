/**
 * FORME Email Provider Base Class (Abstract Provider Interface)
 * Defines the standard contract that all email transport adapters must fulfill.
 */
export class BaseEmailProvider {
  constructor(name) {
    if (new.target === BaseEmailProvider) {
      throw new TypeError('Cannot construct BaseEmailProvider directly; implement an adapter.');
    }
    this.name = name;
  }

  /**
   * Dispatches an email through the underlying provider transport.
   * @param {Object} options
   * @param {string|string[]} options.to - Recipient email address(es)
   * @param {string} options.subject - Email subject line
   * @param {string} options.html - Responsive HTML email body
   * @param {string} [options.text] - Plain text fallback body
   * @param {string} [options.fromName] - Sender display name
   * @param {string} [options.fromEmail] - Sender email address
   * @param {string} [options.replyTo] - Reply-To address
   * @param {string[]} [options.tags] - Categorization tags
   * @param {Object} [options.metadata] - Provider metadata
   * @param {Array} [options.attachments] - File attachments
   * @returns {Promise<{ messageId: string, provider: string, raw: any }>}
   */
  async send(options) {
    throw new Error(`send() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Health check probe to verify credentials and connectivity with the provider.
   * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
   */
  async verifyConnection() {
    throw new Error(`verifyConnection() must be implemented by ${this.constructor.name}`);
  }
}

export default BaseEmailProvider;

