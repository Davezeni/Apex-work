import { Router } from 'express';
import { addUserSkillSchema, updateUserSkillSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as us from '../services/userSkills.service.js';

const router: Router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    return success(res, { items: await us.listMySkills(req.user!.sub) });
  }),
);

router.post(
  '/',
  validate(addUserSkillSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AddUserSkillInput;
    return success(res, await us.addSkill(req.user!.sub, body), 201);
  }),
);

router.patch(
  '/:skillId',
  validate(updateUserSkillSchema),
  asyncHandler(async (req, res) => {
    const { skillId } = req.params as { skillId: string };
    const body = req.body as import('@apex-work/shared').UpdateUserSkillInput;
    return success(res, await us.updateLevel(req.user!.sub, skillId, body.level));
  }),
);

router.delete(
  '/:skillId',
  asyncHandler(async (req, res) => {
    const { skillId } = req.params as { skillId: string };
    return success(res, await us.removeSkill(req.user!.sub, skillId));
  }),
);

export default router;
