import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as n from '../services/notifications.service.js';

const router: Router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = req.query as { cursor?: string; limit?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 30), 1), 100);
    const result = await n.listNotifications(req.user!.sub, { cursor: query.cursor, limit });
    return success(res, result);
  }),
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await n.listUnreadCount(req.user!.sub);
    return success(res, { count });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const count = await n.markAllRead(req.user!.sub);
    return success(res, { count });
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    await n.markOneRead(req.user!.sub, id);
    return success(res, { ok: true });
  }),
);

export default router;
