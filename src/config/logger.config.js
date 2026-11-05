import morgan from 'morgan';
import env from './env.config.js';

// Custom token for response time in ms
morgan.token('colored-status', (req, res) => {
  const status = res.statusCode;
  return status >= 500
    ? `\x1b[31m${status}\x1b[0m` // Red for 5xx
    : status >= 400
    ? `\x1b[33m${status}\x1b[0m` // Yellow for 4xx
    : status >= 300
    ? `\x1b[36m${status}\x1b[0m` // Cyan for 3xx
    : `\x1b[32m${status}\x1b[0m`; // Green for 2xx
});

const developmentFormat = ':method :url :colored-status :response-time ms - :res[content-length]';
const productionFormat = 'combined';

export const requestLogger = morgan(env.NODE_ENV === 'production' ? productionFormat : developmentFormat, {
  skip: (req) => req.url === '/api/v1/health' || req.url === '/api/health',
});

export const logger = {
  info: (msg, meta = {}) => console.log(`[INFO] ${msg}`, Object.keys(meta).length ? meta : ''),
  warn: (msg, meta = {}) => console.warn(`\x1b[33m[WARN] ${msg}\x1b[0m`, Object.keys(meta).length ? meta : ''),
  error: (msg, err = null) => console.error(`\x1b[31m[ERROR] ${msg}\x1b[0m`, err?.stack || err || ''),
  debug: (msg, meta = {}) => {
    if (env.NODE_ENV !== 'production') console.debug(`[DEBUG] ${msg}`, meta);
  },
};

export default { requestLogger, logger };

