import { Router } from 'express';
import {
  loginSchema,
  refreshSchema,
  requestOtpSchema,
  signupSchema,
  verifyOtpSchema,
} from '@apex-work/shared';
import { validate } from '../middleware/validate.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { success } from '../lib/response.js';
import * as authService from '../services/auth.service.js';

const router: Router = Router();

const clientCtx = (req: Parameters<typeof asyncHandler>[0] extends never ? never : Parameters<Parameters<typeof asyncHandler>[0]>[0]) => ({
  userAgent: (req as { headers: Record<string, string | undefined> }).headers?.['user-agent'],
  ipAddress: (req as { ip?: string }).ip,
});

router.post(
  '/otp/request',
  otpLimiter,
  validate(requestOtpSchema),
  asyncHandler(async (req, res) => {
    const { phone, purpose } = req.body as import('@apex-work/shared').RequestOtpInput;
    await authService.requestOtp(phone, purpose);
    // Never confirm existence of user in this response
    return success(res, { sent: true });
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
    if (!otpToken) throw new (await import('../lib/errors.js')).BadRequestError('otpToken required');
    const result = await authService.loginWithOtp(otpToken, clientCtx(req));
    return success(res, result);
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
