import { Router } from 'express';
import {
  completeOAuthSignupSchema,
  loginSchema,
  loginWithPinSchema,
  oauthHandoffSchema,
  oauthProviderSchema,
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
import { BadRequestError, ConflictError } from '../lib/errors.js';
import * as authService from '../services/auth.service.js';
import * as oauth from '../services/oauth.service.js';
import * as oauthAccounts from '../services/oauthAccounts.service.js';
import { env } from '../config/env.js';

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

const oauthProviderFromRequest = (req: { params: unknown }) => {
  const value = (req.params as { provider?: unknown }).provider;
  const parsed = oauthProviderSchema.safeParse(value);
  if (!parsed.success) throw new BadRequestError('Unsupported OAuth provider');
  return parsed.data;
};

const oauthQuery = (req: { query: unknown }) =>
  req.query as {
    code?: string;
    state?: string;
    error?: string;
    role?: string;
    next?: string;
  };

/** Only derive the callback from a known deployment host; never trust an arbitrary Host header. */
const oauthRequestBase = (req: {
  protocol: string;
  get(name: string): string | undefined;
}): string => {
  const host = req.get('host') ?? '';
  if (
    host === 'apex-work-api.onrender.com' ||
    /^localhost(?::\d+)?$/.test(host) ||
    /^127\.0\.0\.1(?::\d+)?$/.test(host)
  ) {
    return `${req.protocol}://${host}`;
  }
  return env.API_URL;
};

/** Begin Google/GitHub OAuth without exposing provider secrets to the browser. */
router.get(
  '/oauth/:provider/start',
  authLimiter,
  asyncHandler(async (req, res) => {
    const provider = oauthProviderFromRequest(req);
    const query = oauthQuery(req);
    const role = query.role === 'FREELANCER' ? 'FREELANCER' : 'CLIENT';
    try {
      const authorizationUrl = await oauth.start(provider, role, query.next, oauthRequestBase(req));
      return res.redirect(authorizationUrl);
    } catch {
      return res.redirect(oauth.callbackErrorUrl('provider_unavailable', query.next));
    }
  }),
);

/**
 * Start an authenticated provider-link flow. The browser first obtains this
 * URL with its Bearer token, then follows the provider redirect. The Redis
 * state is bound to this account, so a callback cannot attach to another one.
 */
router.post(
  '/oauth/:provider/link/start',
  authLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = oauthProviderFromRequest(req);
    const query = oauthQuery(req);
    const role = req.user!.role === 'FREELANCER' ? 'FREELANCER' : 'CLIENT';
    const authorizationUrl = await oauth.start(provider, role, query.next, oauthRequestBase(req), {
      mode: 'link',
      userId: req.user!.sub,
    });
    return success(res, { authorizationUrl });
  }),
);

/** Provider callback. Exchanges the code server-side, then hands the session to the web app once. */
router.get(
  '/oauth/:provider/callback',
  asyncHandler(async (req, res) => {
    const provider = oauthProviderFromRequest(req);
    const query = oauthQuery(req);
    let state: Awaited<ReturnType<typeof oauth.consumeState>> | null = null;
    try {
      if (!query.state) throw new BadRequestError('OAuth response was incomplete');
      state = await oauth.consumeState(query.state, provider);
      if (query.error) throw new BadRequestError('OAuth sign-in was cancelled');
      if (!query.code) throw new BadRequestError('OAuth response was incomplete');
      const profile = await oauth.exchangeCode(
        provider,
        query.code,
        state.callbackBaseUrl ?? oauthRequestBase(req),
      );

      if (state.mode === 'link') {
        if (!state.userId) throw new BadRequestError('OAuth link session is invalid');
        await oauthAccounts.link(state.userId, profile);
        return res.redirect(oauth.callbackLinkUrl(provider, state.next));
      }

      const result = await authService.loginWithOAuth(profile, clientCtx(req));

      if (result.pending) {
        // OAuth has already authenticated the external identity. Create the
        // account now with phone=null, then use the normal logged-in step-up
        // page for phone verification before high-trust actions.
        const created = await authService.completeOAuthSignup(
          profile,
          {
            fullName: profile.fullName,
            role: state.role,
          },
          clientCtx(req),
        );
        const handoff = await oauth.createHandoff({
          ...created.tokens,
          phone: null,
          requiresPhone: true,
        });
        return res.redirect(oauth.callbackHandoffUrl(handoff, state.next));
      }

      const handoff = await oauth.createHandoff({
        ...result.tokens,
        phone: result.phone,
        requiresPhone: result.requiresPhone,
      });
      return res.redirect(oauth.callbackHandoffUrl(handoff, state.next));
    } catch (error) {
      const code =
        state?.mode === 'link'
          ? error instanceof ConflictError
            ? 'oauth_link_conflict'
            : 'oauth_link_failed'
          : 'oauth_failed';
      return res.redirect(oauth.callbackErrorUrl(code, state?.next, state?.mode));
    }
  }),
);

/** Exchange a one-time browser handoff for the normal Apex-Work session tokens. */
router.post(
  '/oauth/handoff',
  authLimiter,
  validate(oauthHandoffSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').OAuthHandoffInput;
    return success(res, await oauth.consumeHandoff(body.handoff));
  }),
);

/** Backward-compatible completion route for an OAuth pending signup with phone OTP. */
router.post(
  '/oauth/complete-signup',
  authLimiter,
  validate(completeOAuthSignupSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CompleteOAuthSignupInput;
    const pending = await oauth.getPending(body.oauthToken);
    const result = await authService.completeOAuthSignup(
      pending,
      {
        phone: body.phone,
        otpToken: body.otpToken,
        fullName: body.fullName,
        role: body.role,
      },
      clientCtx(req),
    );
    await oauth.consumePending(body.oauthToken);
    return success(res, { ...result, phone: body.phone, next: pending.next });
  }),
);

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
