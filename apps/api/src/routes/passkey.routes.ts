import { Router } from 'express';
import { z } from 'zod';
import { phoneSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { success } from '../lib/response.js';
import { BadRequestError } from '../lib/errors.js';
import * as webauthn from '../services/webauthn.service.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { randomToken, sha256 } from '../lib/hash.js';
import { env } from '../config/env.js';

const router: Router = Router();

// -------------------- Registration (authed) --------------------

router.get(
  '/register-options',
  requireAuth,
  asyncHandler(async (req, res) => {
    const options = await webauthn.beginRegistration(req.user!.sub);
    return success(res, options);
  }),
);

const registerBodySchema = z.object({
  response: z.unknown(), // SimpleWebAuthn validates the shape itself
  label: z.string().trim().max(60).optional(),
});

router.post(
  '/register',
  requireAuth,
  validate(registerBodySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { response: unknown; label?: string };
    if (!body.response) throw new BadRequestError('Missing WebAuthn response');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passkey = await webauthn.finishRegistration(req.user!.sub, body.response as any, body.label);
    return success(res, passkey, 201);
  }),
);

// -------------------- Authentication (unauthed) --------------------

const loginOptionsSchema = z.object({ phone: phoneSchema });

router.post(
  '/login-options',
  authLimiter,
  validate(loginOptionsSchema),
  asyncHandler(async (req, res) => {
    const { phone } = req.body as { phone: string };
    const options = await webauthn.beginAuthentication(phone);
    return success(res, options);
  }),
);

const loginSchema = z.object({
  phone: phoneSchema,
  response: z.unknown(),
});

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { phone: string; response: unknown };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { userId, role } = await webauthn.finishAuthentication(body.phone, body.response as any);

    // Mint JWT tokens directly (WebAuthn already provided strong auth).
    const accessToken = signAccessToken({ sub: userId, role: role as 'CLIENT' | 'FREELANCER' | 'ADMIN' });
    const jti = randomToken(16);
    const refreshToken = signRefreshToken({ sub: userId, jti });
    const days = env.JWT_REFRESH_EXPIRES_IN === '30d' ? 30 : 30; // simple parse; refresh_util covers all shapes
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(jti),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
    });
    return success(res, {
      user: { id: userId, role },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
      },
    });
  }),
);

// -------------------- Management (authed) --------------------

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await webauthn.listUserPasskeys(req.user!.sub);
    return success(res, { items });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const deleted = await webauthn.deletePasskey(req.user!.sub, id);
    if (!deleted) throw new BadRequestError('Passkey not found or already deleted');
    return success(res, { ok: true });
  }),
);

export default router;
