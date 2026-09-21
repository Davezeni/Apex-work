import { Router } from 'express';
import {
  agencyMemberRoleSchema,
  agencyProjectSchema,
  agencyUpdateSchema,
  createAgencySchema,
  inviteAgencyMemberSchema,
} from '@apex-work/shared';
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
  '/:id/chat',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await agencies.teamChat(req.user!.sub, id));
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

router.patch(
  '/:id',
  validate(agencyUpdateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AgencyUpdateInput;
    return success(
      res,
      await agencies.updateTeam(req.user!.sub, (req.params as { id: string }).id, body),
    );
  }),
);

router.patch(
  '/:id/members/:memberId/role',
  validate(agencyMemberRoleSchema),
  asyncHandler(async (req, res) => {
    const params = req.params as { id: string; memberId: string };
    const body = req.body as import('@apex-work/shared').AgencyMemberRoleInput;
    return success(
      res,
      await agencies.setMemberRole(req.user!.sub, params.id, params.memberId, body.role),
    );
  }),
);

router.post(
  '/:id/projects',
  validate(agencyProjectSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AgencyProjectInput;
    return success(
      res,
      await agencies.addProject(req.user!.sub, (req.params as { id: string }).id, body),
      201,
    );
  }),
);

router.delete(
  '/:id/projects/:projectId',
  asyncHandler(async (req, res) => {
    const params = req.params as { id: string; projectId: string };
    return success(res, await agencies.removeProject(req.user!.sub, params.id, params.projectId));
  }),
);

router.get(
  '/:id/invites',
  asyncHandler(async (req, res) => {
    return success(res, {
      items: await agencies.listInvites(req.user!.sub, (req.params as { id: string }).id),
    });
  }),
);

router.get(
  '/:id/dashboard',
  asyncHandler(async (req, res) => {
    return success(res, await agencies.dashboard(req.user!.sub, (req.params as { id: string }).id));
  }),
);

export default router;
