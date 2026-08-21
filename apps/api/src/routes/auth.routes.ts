import { Router } from 'express';
import {
  loginSchema,
  loginWithPinSchema,
  refreshSchema,
  requestOtpSchema,
  setPinSchema,
  signupSchema,
  trustedDeviceLoginSchema,
  verifyOtpSchema,
} from '@apex-work/shared';
import { validate } from '../middleware/validate.js';
import { authLimiter, otpLimiter, pinLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { success } from '../lib/response.js';
import { BadRequestError } from '../lib/errors.js';
import * as authService from '../services/auth.service.js';

const router: Router = Router();

/**
 * Extract user-agent + IP for audit fields on tokens and trusted devices.
 * Kept type-loose because Express's Request typings don't play nice with
 * cross-cutting helpers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientCtx = (req: any) => ({
  userAgent: req?.headers?.['user-agent'],
  ipAddress: req?.ip,
});

router.post(
  '/otp/request',
  otpLimiter,
  validate(requestOtpSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').RequestOtpInput;
    const result = await authService.requestOtp(body.phone, body.purpose, body.deviceToken);
    return success(res, result);
  }),
);

router.post(
  '/otp/verify',
  authLimiter,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const { phone, code } = req.body as import('@apex-work/shared').VerifyOtpInput;
    const result = await authService.verifyOtp(phone, code);
    return success(res, result);
  }),
);

router.post(
  '/signup',
  authLimiter,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').SignupInput;
    const result = await authService.signup(body, clientCtx(req));
    return success(res, result, 201);
  }),
);

router.post(
  '/login/otp',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { otpToken } = req.body as { otpToken: string };
    if (!otpToken) throw new BadRequestError('otpToken required');
    const result = await authService.loginWithOtp(otpToken, clientCtx(req));
    return success(res, result);
  }),
);

/**
 * Skip-OTP login using a device token minted on a previous OTP verification.
 * The token is stored client-side (localStorage) and hashed server-side.
 */
router.post(
  '/login/trusted-device',
  authLimiter,
  validate(trustedDeviceLoginSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').TrustedDeviceLoginInput;
    const result = await authService.loginWithTrustedDevice(
      body.phone,
      body.deviceToken,
      clientCtx(req),
    );
    return success(res, result);
  }),
);

/** PIN-based repeat login (also requires a trusted device). */
router.post(
  '/login/pin',
  pinLimiter,
  validate(loginWithPinSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').LoginWithPinInput;
    const result = await authService.loginWithPin(
      body.phone,
      body.pin,
      body.deviceToken,
      clientCtx(req),
    );
    return success(res, result);
  }),
);

/** Set / replace the current user's PIN. */
router.post(
  '/pin',
  requireAuth,
  validate(setPinSchema),
  asyncHandler(async (req, res) => {
    const { pin } = req.body as import('@apex-work/shared').SetPinInput;
    await authService.setPin(req.user!.sub, pin);
    return success(res, { ok: true });
  }),
);

router.delete(
  '/pin',
  requireAuth,
  asyncHandler(async (req, res) => {
    await authService.removePin(req.user!.sub);
    return success(res, { ok: true });
  }),
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as import('@apex-work/shared').LoginInput;
    const result = await authService.loginWithPassword(email, password, clientCtx(req));
    return success(res, result);
  }),
);

router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as import('@apex-work/shared').RefreshInput;
    const tokens = await authService.refresh(refreshToken, clientCtx(req));
    return success(res, tokens);
  }),
);

router.post(
  '/logout',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as import('@apex-work/shared').RefreshInput;
    await authService.logout(refreshToken);
    return success(res, { ok: true });
  }),
);

export default router;
