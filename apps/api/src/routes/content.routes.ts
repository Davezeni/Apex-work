/** Public content routes — curated homepage/site content (no auth required). */
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { success } from '../lib/response.js';
import { SETTING_KEYS, getSetting } from '../services/admin/settings.service.js';
import { sanitiseAnnouncement } from '../lib/announcement.js';

const router: Router = Router();

/** GET /content/announcement — the current site-wide announcement banner. */
router.get(
  '/announcement',
  asyncHandler(async (_req, res) => {
    const raw = await getSetting<unknown>(SETTING_KEYS.siteAnnouncement, null);
    return success(res, { announcement: sanitiseAnnouncement(raw) });
  }),
);

export default router;
