import { Router } from 'express';
import { signUploadSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { BadRequestError, ConflictError } from '../lib/errors.js';
import { storage } from '../services/storage.service.js';

const router: Router = Router();

router.use(requireAuth);

/**
 * POST /uploads/sign — mint a one-shot signed upload URL.
 * Client will then PUT directly to Supabase Storage.
 * We validate size + MIME here (defense-in-depth with bucket policies).
 */
router.post(
  '/sign',
  validate(signUploadSchema),
  asyncHandler(async (req, res) => {
    if (!storage.isConfigured()) {
      throw new ConflictError('File uploads are not configured on this environment');
    }
    const body = req.body as import('@apex-work/shared').SignUploadInput;

    const check = storage.validate(body);
    if (!check.ok) throw new BadRequestError(check.error ?? 'Invalid upload');

    const result = await storage.createSignedUpload({
      ...body,
      ownerId: req.user!.sub,
    });
    return success(res, result);
  }),
);

export default router;
