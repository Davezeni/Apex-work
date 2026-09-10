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
import uploadsRoutes from './uploads.routes.js';
import portfolioRoutes from './portfolio.routes.js';
import reviewsRoutes from './reviews.routes.js';
import walletRoutes from './wallet.routes.js';
import jobsRoutes from './jobs.routes.js';
import moderationRoutes from './moderation.routes.js';
import offersRoutes from './offers.routes.js';
import aiRoutes from './ai.routes.js';
import pushRoutes from './push.routes.js';
import resumeRoutes from './resume.routes.js';
import draftsRoutes from './drafts.routes.js';
import searchRoutes from './search.routes.js';
import adminRoutes from './admin.routes.js';
import adminOpsRoutes from './adminOps.routes.js';
import contentRoutes from './content.routes.js';
import reactionsRoutes from './reactions.routes.js';
import milestonesRoutes from './milestones.routes.js';
import groupsRoutes from './groups.routes.js';
import userSkillsRoutes from './userSkills.routes.js';
import disputesRoutes from './disputes.routes.js';
import savedSearchesRoutes from './savedSearches.routes.js';
import savedGigsRoutes from './savedGigs.routes.js';
import geoRoutes from './geo.routes.js';
import cronRoutes from './cron.routes.js';
import supportRoutes from './support.routes.js';
import recommendationsRoutes from './recommendations.routes.js';
import subscriptionsRoutes from './subscriptions.routes.js';
import agenciesRoutes from './agencies.routes.js';
import referralsRoutes from './referrals.routes.js';
import translateRoutes from './translate.routes.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { logger } from '../config/logger.js';

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
// Coarse readiness probe. Only exposes boolean per-dependency state to
// callers; the underlying DB error and Redis status strings are logged
// server-side and never returned, so unauthenticated requesters can't learn
// about the infra (hostnames, connection errors, version details).
router.get('/ready', async (_req, res) => {
  const checks: Record<string, boolean> = { db: false, redis: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch (e) {
    logger.error({ err: e }, 'Readiness DB check failed');
  }
  checks.redis = redis.status === 'ready';
  if (!checks.redis) {
    // Log the real status for operators only.
    logger.warn({ redisStatus: redis.status }, 'Readiness Redis check not ready');
  }
  const allOk = Object.values(checks).every(Boolean);
  res.status(allOk ? 200 : 503).json({ ok: allOk, ready: allOk, checks });
});

router.use('/auth', authRoutes);
router.use('/auth/passkey', passkeyRoutes);
router.use('/me', meRoutes);
router.use('/me/devices', devicesRoutes);
router.use('/me/portfolio', portfolioRoutes);
router.use('/me/wallet', walletRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/gigs', gigsRoutes);
router.use('/jobs', jobsRoutes);
router.use('/skills', skillsRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/conversations', chatRoutes);
router.use('/users', usersRoutes);
router.use('/orders', ordersRoutes);
router.use('/payments', paymentsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/offers', offersRoutes);
router.use('/moderation', moderationRoutes);
router.use('/ai', aiRoutes);
router.use('/push', pushRoutes);
router.use('/me/resume', resumeRoutes);
router.use('/me/drafts', draftsRoutes);
router.use('/search', searchRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/ops', adminOpsRoutes);
router.use('/messages', reactionsRoutes);
router.use('/', milestonesRoutes); // mounts /orders/:id/milestones + /milestones/:id/...
router.use('/groups', groupsRoutes);
router.use('/me/skills', userSkillsRoutes);
router.use('/disputes', disputesRoutes);
router.use('/me/saved-searches', savedSearchesRoutes);
router.use('/me/saved-gigs', savedGigsRoutes);
router.use('/geo', geoRoutes);
router.use('/cron', cronRoutes);
router.use('/support', supportRoutes);
router.use('/content', contentRoutes);
router.use('/recommendations', recommendationsRoutes);
router.use('/referrals', referralsRoutes);
router.use('/me/subscription', subscriptionsRoutes);
router.use('/me/teams', agenciesRoutes);
router.use('/translate', translateRoutes);

export default router;
