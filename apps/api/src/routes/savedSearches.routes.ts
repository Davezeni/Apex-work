import { Router } from 'express';
import { createSavedSearchSchema, updateSavedSearchSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as ss from '../services/savedSearches.service.js';

const router: Router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => success(res, { items: await ss.listMine(req.user!.sub) })),
);

router.post(
  '/',
  validate(createSavedSearchSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateSavedSearchInput;
    return success(res, await ss.create(req.user!.sub, body), 201);
  }),
);

router.patch(
  '/:id',
  validate(updateSavedSearchSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').UpdateSavedSearchInput;
    return success(res, await ss.update(id, req.user!.sub, body));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await ss.remove(id, req.user!.sub));
  }),
);

export default router;
