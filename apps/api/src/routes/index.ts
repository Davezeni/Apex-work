import { Router } from 'express';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import gigsRoutes from './gigs.routes.js';

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

router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/gigs', gigsRoutes);

export default router;
