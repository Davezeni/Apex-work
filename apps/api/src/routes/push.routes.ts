import { Router } from 'express';
import { z } from 'zod';
import { pushSubscriptionSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as push from '../services/push.service.js';

const router: Router = Router();

/** Public: give the browser our VAPID public key so it can subscribe. */
router.get('/vapid-key', (_req, res) => {
  return success(res, { publicKey: push.getVapidPublicKey(), configured: push.isPushConfigured() });
});

router.use(requireAuth);

router.post(
  '/subscribe',
  validate(pushSubscriptionSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').PushSubscriptionInput;
    const row = await push.subscribe({
      userId: req.user!.sub,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      authKey: body.keys.auth,
      userAgent: body.userAgent,
    });
    return success(res, { id: row.id });
  }),
);

const unsubSchema = z.object({ endpoint: z.string().url() });
router.post(
  '/unsubscribe',
  validate(unsubSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof unsubSchema>;
    await push.unsubscribe(body.endpoint);
    return success(res, { ok: true });
  }),
);

/** Dev-only test push (for QA'ing the SW). Idempotent. */
router.post(
  '/test',
  asyncHandler(async (req, res) => {
    const result = await push.sendPush(req.user!.sub, {
      title: 'Apex-Work',
      body: 'Push works 🎉',
      url: '/notifications',
      tag: 'test',
    });
    return success(res, result);
  }),
);

export default router;
