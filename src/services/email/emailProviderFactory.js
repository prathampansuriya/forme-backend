import env from '../../config/env.config.js';
import NodemailerProvider from './NodemailerProvider.js';
import BrevoProvider from './BrevoProvider.js';

let nodemailerInstance = null;
let brevoInstance = null;

export const getEmailProvider = (overrideProvider = null) => {
  const chosenProvider = (overrideProvider || env.EMAIL_PROVIDER || 'nodemailer').toLowerCase();

  if (chosenProvider === 'brevo') {
    if (!brevoInstance) {
      brevoInstance = new BrevoProvider();
    }
    return brevoInstance;
  }

  if (!nodemailerInstance) {
    nodemailerInstance = new NodemailerProvider();
  }
  return nodemailerInstance;
};

export const getSpecificProvider = (providerName) => {
  const normalized = (providerName || '').toLowerCase();
  if (normalized === 'brevo') {
    if (!brevoInstance) brevoInstance = new BrevoProvider();
    return brevoInstance;
  }
  if (!nodemailerInstance) nodemailerInstance = new NodemailerProvider();
  return nodemailerInstance;
};

export default {
  getEmailProvider,
  getSpecificProvider,
};

