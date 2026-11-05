import env from './env.config.js';

export const jwtConfig = {
  accessSecret: env.JWT_ACCESS_SECRET || 'forme_access_token_super_secret_key_change_in_production',
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshSecret: env.JWT_REFRESH_SECRET || 'forme_refresh_token_super_secret_key_change_in_production',
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',

  cookieOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/v1/auth',
  },
};

export default jwtConfig;

