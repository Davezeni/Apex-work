import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { translateLimiter } from '../middleware/rateLimit.js';
import { success } from '../lib/response.js';
import { translateSchema, type TranslateResult } from '@apex-work/shared';
import { detectSource, translateText } from '../services/translate.service.js';

const router: Router = Router();

/**
 * POST /translate — one-tap chat message translation.
 *
 * Authenticated + rate-limited (30/min/user). The provider is a free
 * keyless service (MyMemory); responses are cached 24h so repeated
 * translations of the same message cost nothing.
 */
router.post(
  '/',
  requireAuth,
  translateLimiter,
  validate(translateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { text: string; source?: string; target: string };
    const source = body.source ?? detectSource(body.text);
    const result: TranslateResult = await translateText(body.text, source, body.target);
    return success(res, result);
  }),
);

export default router;
