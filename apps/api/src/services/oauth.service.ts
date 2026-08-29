import { redis } from '../lib/redis.js';
import { randomToken } from '../lib/hash.js';
import { env } from '../config/env.js';
import { BadRequestError, ConflictError } from '../lib/errors.js';
import type { OAuthProvider, UserRole } from '@apex-work/shared';

const STATE_PREFIX = 'oauth:state:';
const PENDING_PREFIX = 'oauth:pending:';
const HANDOFF_PREFIX = 'oauth:handoff:';
const STATE_TTL_SECONDS = 10 * 60;
const PENDING_TTL_SECONDS = 15 * 60;
const HANDOFF_TTL_SECONDS = 60;

export type OAuthMode = 'login' | 'link';

export interface OAuthState {
  provider: OAuthProvider;
  role: Extract<UserRole, 'CLIENT' | 'FREELANCER'>;
  next: string;
  callbackBaseUrl?: string;
  /** link states are bound to the already-authenticated Apex-Work user. */
  mode: OAuthMode;
  userId?: string;
}

export interface OAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email?: string;
  fullName: string;
  avatarUrl?: string;
}

export interface OAuthPending extends OAuthProfile {
  role: Extract<UserRole, 'CLIENT' | 'FREELANCER'>;
  next: string;
}

export interface OAuthHandoff {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  deviceToken?: string;
  deviceExpiresAt?: string | Date;
  phone: string | null;
  requiresPhone: boolean;
}

const apiBase = () => env.API_URL.replace(/\/$/, '');
const webBase = () => env.WEB_URL.replace(/\/$/, '');

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return provider === 'google'
    ? !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET
    : !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET;
}

export function callbackUrl(provider: OAuthProvider, baseUrl = apiBase()): string {
  return `${baseUrl.replace(/\/$/, '')}/v1/auth/oauth/${provider}/callback`;
}

function safeNext(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function clientConfig(provider: OAuthProvider): { clientId: string; clientSecret: string } {
  const config =
    provider === 'google'
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  if (!config.clientId || !config.clientSecret) {
    throw new ConflictError(`${provider} sign-in is not configured yet`);
  }
  return { clientId: config.clientId, clientSecret: config.clientSecret };
}

export async function start(
  provider: OAuthProvider,
  role: Extract<UserRole, 'CLIENT' | 'FREELANCER'>,
  next?: string,
  requestBaseUrl?: string,
  options: { mode?: OAuthMode; userId?: string } = {},
): Promise<string> {
  const { clientId } = clientConfig(provider);
  const state = randomToken(24);
  const stateData: OAuthState = {
    provider,
    role,
    next: safeNext(next),
    callbackBaseUrl: requestBaseUrl?.replace(/\/$/, '') || apiBase(),
    mode: options.mode ?? 'login',
    ...(options.userId ? { userId: options.userId } : {}),
  };
  if (stateData.mode === 'link' && !stateData.userId) {
    throw new BadRequestError('OAuth link session is missing its account');
  }
  await redis.setex(`${STATE_PREFIX}${state}`, STATE_TTL_SECONDS, JSON.stringify(stateData));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(provider, stateData.callbackBaseUrl),
    response_type: 'code',
    state,
  });
  if (provider === 'google') {
    params.set('scope', 'openid email profile');
    params.set('access_type', 'online');
    params.set('prompt', 'select_account');
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  params.set('scope', 'read:user user:email');
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function consumeState(state: string, provider: OAuthProvider): Promise<OAuthState> {
  if (!state || state.length > 120) throw new BadRequestError('Invalid OAuth state');
  const key = `${STATE_PREFIX}${state}`;
  // GETDEL makes the state single-use even if two callbacks arrive at once.
  const raw = await redis.getdel(key);
  if (!raw) throw new BadRequestError('OAuth session expired. Please try again.');
  const parsed = JSON.parse(raw) as OAuthState;
  if (parsed.provider !== provider) throw new BadRequestError('OAuth provider mismatch');
  return parsed;
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const data = (await res.json().catch(() => ({}))) as unknown;
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
}

async function exchangeGoogle(code: string, requestBaseUrl?: string): Promise<OAuthProfile> {
  const { clientId, clientSecret } = clientConfig('google');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl('google', requestBaseUrl),
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tokenData = await parseJson(tokenResponse);
  const accessToken = typeof tokenData.access_token === 'string' ? tokenData.access_token : null;
  if (!tokenResponse.ok || !accessToken)
    throw new BadRequestError('Google sign-in could not be completed');

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  const profile = await parseJson(profileResponse);
  const providerAccountId = typeof profile.sub === 'string' ? profile.sub : null;
  const fullName = typeof profile.name === 'string' ? profile.name.trim() : '';
  if (!profileResponse.ok || !providerAccountId || !fullName) {
    throw new BadRequestError('Google did not return a usable profile');
  }
  const email =
    profile.email_verified === true && typeof profile.email === 'string'
      ? profile.email.trim().toLowerCase()
      : undefined;
  const avatarUrl = typeof profile.picture === 'string' ? profile.picture : undefined;
  return { provider: 'google', providerAccountId, email, fullName, avatarUrl };
}

async function exchangeGithub(code: string, requestBaseUrl?: string): Promise<OAuthProfile> {
  const { clientId, clientSecret } = clientConfig('github');
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl('github', requestBaseUrl),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tokenData = await parseJson(tokenResponse);
  const accessToken = typeof tokenData.access_token === 'string' ? tokenData.access_token : null;
  if (!tokenResponse.ok || !accessToken)
    throw new BadRequestError('GitHub sign-in could not be completed');

  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' };
  const [profileResponse, emailResponse] = await Promise.all([
    fetch('https://api.github.com/user', { headers, signal: AbortSignal.timeout(10_000) }),
    fetch('https://api.github.com/user/emails', { headers, signal: AbortSignal.timeout(10_000) }),
  ]);
  const profile = await parseJson(profileResponse);
  const emails = (await emailResponse.json().catch(() => [])) as unknown;
  const emailRows = Array.isArray(emails) ? emails : [];
  const primaryEmail = emailRows.find((row) => {
    if (!row || typeof row !== 'object') return false;
    const item = row as Record<string, unknown>;
    return item.primary === true && item.verified === true && typeof item.email === 'string';
  }) as Record<string, unknown> | undefined;
  const providerAccountId =
    typeof profile.id === 'number' || typeof profile.id === 'string' ? String(profile.id) : null;
  const fullName =
    typeof profile.name === 'string' && profile.name.trim()
      ? profile.name.trim()
      : typeof profile.login === 'string'
        ? profile.login
        : '';
  if (!profileResponse.ok || !providerAccountId || !fullName) {
    throw new BadRequestError('GitHub did not return a usable profile');
  }
  const email =
    typeof primaryEmail?.email === 'string' ? primaryEmail.email.trim().toLowerCase() : undefined;
  const avatarUrl = typeof profile.avatar_url === 'string' ? profile.avatar_url : undefined;
  return { provider: 'github', providerAccountId, email, fullName, avatarUrl };
}

export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  requestBaseUrl?: string,
): Promise<OAuthProfile> {
  if (!code || code.length > 2000) throw new BadRequestError('Invalid OAuth authorization code');
  return provider === 'google'
    ? exchangeGoogle(code, requestBaseUrl)
    : exchangeGithub(code, requestBaseUrl);
}

export async function createPending(profile: OAuthProfile, state: OAuthState): Promise<string> {
  const token = randomToken(32);
  const pending: OAuthPending = { ...profile, role: state.role, next: state.next };
  await redis.setex(`${PENDING_PREFIX}${token}`, PENDING_TTL_SECONDS, JSON.stringify(pending));
  return token;
}

export async function getPending(token: string): Promise<OAuthPending> {
  if (!token || token.length > 120) throw new BadRequestError('Invalid OAuth signup token');
  const raw = await redis.get(`${PENDING_PREFIX}${token}`);
  if (!raw) throw new BadRequestError('OAuth signup session expired. Please start again.');
  return JSON.parse(raw) as OAuthPending;
}

export async function consumePending(token: string): Promise<OAuthPending> {
  const pending = await getPending(token);
  await redis.del(`${PENDING_PREFIX}${token}`);
  return pending;
}

export async function createHandoff(input: OAuthHandoff): Promise<string> {
  const token = randomToken(32);
  await redis.setex(`${HANDOFF_PREFIX}${token}`, HANDOFF_TTL_SECONDS, JSON.stringify(input));
  return token;
}

export async function consumeHandoff(token: string): Promise<OAuthHandoff> {
  if (!token || token.length > 120) throw new BadRequestError('Invalid OAuth handoff');
  const key = `${HANDOFF_PREFIX}${token}`;
  // The browser can retry after a network hiccup, but only the first request
  // is allowed to obtain the session tokens.
  const raw = await redis.getdel(key);
  if (!raw) throw new BadRequestError('OAuth handoff expired. Please sign in again.');
  return JSON.parse(raw) as OAuthHandoff;
}

function webPathWithQuery(path: string, params: Record<string, string>): string {
  const url = new URL(path, `${webBase()}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export function callbackErrorUrl(code: string, next?: string, mode: OAuthMode = 'login'): string {
  const safe = safeNext(next);
  if (mode === 'link') {
    return webPathWithQuery('/auth/oauth/callback', {
      oauthError: code,
      oauthMode: 'link',
      next: safe === '/' ? '/settings/connected' : safe,
    });
  }
  return webPathWithQuery('/login', {
    oauthError: code,
    ...(safe !== '/' ? { next: safe } : {}),
  });
}

export function callbackHandoffUrl(handoff: string, next: string): string {
  return webPathWithQuery('/auth/oauth/callback', { handoff, next: safeNext(next) });
}

export function callbackLinkUrl(provider: OAuthProvider, next: string): string {
  return webPathWithQuery('/auth/oauth/callback', {
    linked: provider,
    next: safeNext(next),
  });
}
