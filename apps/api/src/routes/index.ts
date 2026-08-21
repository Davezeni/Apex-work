import { Router } from 'express';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import gigsRoutes from './gigs.routes.js';
import skillsRoutes from './skills.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import chatRoutes from './chat.routes.js';
import usersRoutes from './users.routes.js';
import ordersRoutes from './orders.routes.js';
import paymentsRoutes from './payments.routes.js';
import notificationsRoutes from './notifications.routes.js';
import passkeyRoutes from './passkey.routes.js';
import devicesRoutes from './devices.routes.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

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

router.use('/auth', authRoutes);
router.use('/auth/passkey', passkeyRoutes);
router.use('/me', meRoutes);
router.use('/me/devices', devicesRoutes);
router.use('/gigs', gigsRoutes);
router.use('/skills', skillsRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/conversations', chatRoutes);
router.use('/users', usersRoutes);
router.use('/orders', ordersRoutes);
router.use('/payments', paymentsRoutes);
router.use('/notifications', notificationsRoutes);

export default router;
