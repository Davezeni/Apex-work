import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { BadRequestError } from '../lib/errors.js';
import {
  listUserDevices,
  revokeAllDevices,
  revokeDevice,
} from '../services/trustedDevice.service.js';

const router: Router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await listUserDevices(req.user!.sub);
    return success(res, { items });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const ok = await revokeDevice(req.user!.sub, id);
    if (!ok) throw new BadRequestError('Device not found');
    return success(res, { ok: true });
  }),
);

router.post(
  '/revoke-all',
  asyncHandler(async (req, res) => {
    const count = await revokeAllDevices(req.user!.sub);
    return success(res, { revoked: count });
  }),
);

export default router;
