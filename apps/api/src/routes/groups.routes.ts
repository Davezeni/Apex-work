import { Router } from 'express';
import { createGroupSchema, updateGroupSchema, addMemberSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as g from '../services/groups.service.js';

const router: Router = Router();
router.use(requireAuth);

/** POST /groups — create a new group chat. */
router.post(
  '/',
  validate(createGroupSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateGroupInput;
    return success(res, await g.createGroup(req.user!.sub, body), 201);
  }),
);

/** PATCH /groups/:id — rename / change avatar. Admin only. */
router.patch(
  '/:id',
  validate(updateGroupSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').UpdateGroupInput;
    return success(res, await g.updateGroup(id, req.user!.sub, body));
  }),
);

/** POST /groups/:id/members — add a member. Admin only. */
router.post(
  '/:id/members',
  validate(addMemberSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').AddMemberInput;
    return success(res, await g.addMember(id, req.user!.sub, body.userId), 201);
  }),
);

/** DELETE /groups/:id/members/:userId — remove OR leave. */
router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const { id, userId } = req.params as { id: string; userId: string };
    return success(res, await g.removeMember(id, req.user!.sub, userId));
  }),
);

/** POST /groups/:id/members/:userId/promote — grant admin. */
router.post(
  '/:id/members/:userId/promote',
  asyncHandler(async (req, res) => {
    const { id, userId } = req.params as { id: string; userId: string };
    return success(res, await g.promoteAdmin(id, req.user!.sub, userId));
  }),
);

export default router;
