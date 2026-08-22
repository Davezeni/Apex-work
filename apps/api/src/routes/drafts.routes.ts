import { Router } from 'express';
import { upsertDraftSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as drafts from '../services/drafts.service.js';

const router: Router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await drafts.listMyDrafts(req.user!.sub);
    return success(res, { items });
  }),
);

router.get(
  '/:conversationId',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params as { conversationId: string };
    const d = await drafts.getDraft(req.user!.sub, conversationId);
    return success(res, d);
  }),
);

router.put(
  '/',
  validate(upsertDraftSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').UpsertDraftInput;
    const d = await drafts.upsertDraft({
      userId: req.user!.sub,
      conversationId: body.conversationId,
      body: body.body,
      attachmentUrl: body.attachmentUrl,
      attachmentType: body.attachmentType,
    });
    return success(res, d);
  }),
);

router.delete(
  '/:conversationId',
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params as { conversationId: string };
    await drafts.deleteDraft(req.user!.sub, conversationId);
    return success(res, { ok: true });
  }),
);

export default router;
