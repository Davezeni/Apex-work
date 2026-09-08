/** Public content routes — curated homepage/site content (no auth required). */
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { success } from '../lib/response.js';
import { NotFoundError } from '../lib/errors.js';
import { SETTING_KEYS, getSetting } from '../services/admin/settings.service.js';
import { sanitiseAnnouncement } from '../lib/announcement.js';
import { getContentPage } from '../services/content.service.js';

const router: Router = Router();

/** GET /content/announcement — the current site-wide announcement banner. */
router.get(
  '/announcement',
  asyncHandler(async (_req, res) => {
    const raw = await getSetting<unknown>(SETTING_KEYS.siteAnnouncement, null);
    return success(res, { announcement: sanitiseAnnouncement(raw) });
  }),
);

/** GET /content/:slug — an editable content page (privacy/terms/cookies/faq). */
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const slug = (req.params as { slug?: string }).slug?.trim().toLowerCase() ?? '';
    const page = await getContentPage(slug);
    if (!page) throw new NotFoundError('Content page');
    return success(res, page);
  }),
);

export default router;
