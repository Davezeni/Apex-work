import { Router } from 'express';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import gigsRoutes from './gigs.routes.js';

const router: Router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'apex-work-api', ts: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/gigs', gigsRoutes);

export default router;
