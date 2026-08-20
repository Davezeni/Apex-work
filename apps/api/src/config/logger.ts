import pino from 'pino';
import { env, isDev } from './env.js';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  base: { service: 'apex-work-api', env: env.NODE_ENV },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.otp'],
    censor: '[REDACTED]',
  },
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,
});
