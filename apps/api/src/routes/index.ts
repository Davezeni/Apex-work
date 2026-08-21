import { Router } from 'express';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import gigsRoutes from './gigs.routes.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const router: Router = Router();

/**
 * Health check — must ALWAYS respond, even if Redis/DB is down.
 * Do not depend on any external service here.
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
 * Deep diagnostic — checks DB + Redis + env, exposes real errors.
 * TEMPORARY: remove or protect with a token once deploy is stable.
 */
router.get('/_debug', async (_req, res) => {
  const out: Record<string, unknown> = {
    node: process.version,
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    hasDBUrl: !!process.env.DATABASE_URL,
    hasUnpooled: !!process.env.DATABASE_URL_UNPOOLED,
    hasRedisUrl: !!process.env.REDIS_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
    redisStatus: redis.status,
  };

  // Test DB
  try {
    const rows = await prisma.$queryRaw<Array<{ n: number }>>`SELECT 1 as n`;
    out.dbPing = rows[0]?.n === 1 ? 'ok' : 'unexpected';
  } catch (e) {
    out.dbError = {
      name: (e as Error)?.name,
      message: (e as Error)?.message,
      stack: (e as Error)?.stack?.split('\n').slice(0, 3),
    };
  }

  // Test count
  try {
    const gigsCount = await prisma.gig.count();
    const usersCount = await prisma.user.count();
    out.counts = { gigs: gigsCount, users: usersCount };
  } catch (e) {
    out.countError = {
      name: (e as Error)?.name,
      message: (e as Error)?.message,
      stack: (e as Error)?.stack?.split('\n').slice(0, 3),
    };
  }

  // Test the exact gigs findMany the failing route uses
  try {
    const items = await prisma.gig.findMany({
      where: { status: 'ACTIVE' },
      take: 1,
      select: {
        id: true,
        title: true,
        owner: { select: { id: true, username: true } },
      },
    });
    out.findManySample = items;
  } catch (e) {
    out.findManyError = {
      name: (e as Error)?.name,
      message: (e as Error)?.message,
      stack: (e as Error)?.stack?.split('\n').slice(0, 5),
    };
  }

  res.json(out);
});

router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/gigs', gigsRoutes);

export default router;
