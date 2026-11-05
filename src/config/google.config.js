import { OAuth2Client } from 'google-auth-library';
import env from './env.config.js';

export const googleAuthClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
);

export default googleAuthClient;

