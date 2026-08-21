import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const createApp = (): Express => {
  const app = express();

  // Trust proxy — needed for correct req.ip behind reverse proxies (Koyeb, Fly, Cloudflare)
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Structured request logging
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({ method: req.method, url: req.url, id: req.id }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Next.js sets its own; API doesn't need
    }),
  );

  // CORS — strict allowlist
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // same-origin, curl, mobile apps
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('CORS: origin not allowed'));
      },
      credentials: true,
    }),
  );

  // Body parsers with size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Response compression
  app.use(compression());

  // Health check — mounted BEFORE the rate limiter so it never depends on Redis.
  // Load balancers and uptime monitors must be able to check /v1/health unimpeded.
  app.get('/v1/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'apex-work-api',
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    });
  });

  // Global rate limit for all other endpoints
  app.use('/v1', apiLimiter);

  // Routes
  app.use('/v1', routes);

  // 404 & error handling — MUST be last
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
