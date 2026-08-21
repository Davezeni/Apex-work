import { Router } from 'express';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import gigsRoutes from './gigs.routes.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { sms } from '../services/sms.service.js';
import { env } from '../config/env.js';

const router: Router = Router();

/**
 * Liveness — must ALWAYS respond, even if Redis/DB is down.
 * Never depends on any external service. Use this for load-balancer health checks.
 */
router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'apex-work-api',
    version: process.env.npm_package_version ?? '0.1.0',
    uptime: Math.round(process.uptime()),
    ts: new Date().toISOString(),
  });
});

/**
 * Readiness — actually pings DB + Redis. Slower but says whether the app
 * can serve real traffic. Useful for smoke tests + orchestrators that
 * distinguish "alive" from "ready".
 */
router.get('/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | string> = { db: 'pending', redis: 'pending' };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch (e) {
    checks.db = (e as Error).message.slice(0, 200);
  }
  checks.redis = redis.status === 'ready' ? 'ok' : `not-ready (${redis.status})`;
  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({ ok: allOk, checks });
});

/**
 * TEMPORARY SMS diagnostic — inspects the env vars actually loaded by the
 * running API process, plus optionally does a live AfroMessage send test.
 * Remove once SMS is fully working (or protect behind an admin token).
 */
router.get('/_sms-debug', async (req, res) => {
  const apiKey = env.AFROMESSAGE_API_KEY;
  const identifier = env.AFROMESSAGE_IDENTIFIER_ID;
  const sender = env.AFROMESSAGE_SENDER;

  const info: Record<string, unknown> = {
    provider: sms.name,
    apiKey: {
      present: !!apiKey,
      length: apiKey?.length ?? 0,
      firstChars: apiKey ? apiKey.slice(0, 10) + '…' : null,
      lastChars: apiKey ? '…' + apiKey.slice(-6) : null,
    },
    identifier: {
      present: !!identifier,
      raw: identifier ?? null,
      length: identifier?.length ?? 0,
      trimmedLength: identifier?.trim().length ?? 0,
      hasWhitespace: identifier !== identifier?.trim(),
    },
    sender: {
      present: !!sender,
      raw: sender ?? null,
    },
  };

  // Optional live send if ?send=+2519XXXXXXXX is provided
  const testPhone = req.query.send as string | undefined;
  if (testPhone && /^\+251[79]\d{8}$/.test(testPhone)) {
    const result = await sms.send(testPhone, 'Apex-Work debug SMS — please ignore.');
    info.liveSend = { to: testPhone, ...result };
  }

  res.json(info);
});

router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/gigs', gigsRoutes);

export default router;
