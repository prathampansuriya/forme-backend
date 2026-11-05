import * as Brevo from '@getbrevo/brevo';
import env from './env.config.js';

let brevoClient = null;

export const getBrevoClient = () => {
  if (brevoClient) return brevoClient;

  const apiKey = env.BREVO_API_KEY || process.env.BREVO_API_KEY;

  if (apiKey) {
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
    brevoClient = apiInstance;
  }

  return brevoClient;
};

export default getBrevoClient;

