import { Router } from 'express';
import { createAgencySchema, inviteAgencyMemberSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as agencies from '../services/agencies.service.js';

const router: Router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => success(res, { items: await agencies.listMine(req.user!.sub) })),
);
router.post(
  '/',
  validate(createAgencySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateAgencyInput;
    return success(res, await agencies.create(req.user!.sub, body), 201);
  }),
);
router.post(
  '/:id/members',
  validate(inviteAgencyMemberSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').InviteAgencyMemberInput;
    return success(
      res,
      await agencies.invite(req.user!.sub, (req.params as { id: string }).id, body),
    );
  }),
);
router.delete(
  '/:id/members/:memberId',
  asyncHandler(async (req, res) => {
    const params = req.params as { id: string; memberId: string };
    return success(res, await agencies.removeMember(req.user!.sub, params.id, params.memberId));
  }),
);

export default router;
