/**
 * Typed, validated environment loader.
 * Fails fast on startup if required vars are missing/invalid.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Render + most PaaS set PORT; local dev uses API_PORT. Prefer PORT.
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // Render also sets this in render.yaml. The production default prevents
  // Chapa callbacks from falling back to localhost if a dashboard sync is
  // delayed or the variable was omitted.
  API_URL: z
    .string()
    .url()
    .default(
      process.env.NODE_ENV === 'production'
        ? 'https://apex-work-api.onrender.com'
        : 'http://localhost:4000',
    ),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  DATABASE_URL_UNPOOLED: z.string().optional(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  AFROMESSAGE_API_KEY: z.string().optional(),
  AFROMESSAGE_SENDER: z.string().default('ApexWork'),
  AFROMESSAGE_IDENTIFIER_ID: z.string().optional(),

  SMSETHIOPIA_API_KEY: z.string().optional(),
  // 'auto' (default): SMSEthiopia when its key is set, else AfroMessage, else console.
  SMS_PROVIDER: z.enum(['auto', 'smsethiopia', 'afromessage']).default('auto'),

  CHAPA_SECRET_KEY: z.string().optional(),
  CHAPA_PUBLIC_KEY: z.string().optional(),
  CHAPA_WEBHOOK_SECRET: z.string().optional(),
  CHAPA_ENCRYPTION_KEY: z.string().optional(),
  // Keep automated withdrawals off until Chapa Transfers is configured,
  // bank-code mapping is verified, and a small sandbox payout succeeds.
  CHAPA_TRANSFERS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // OAuth providers. Redirect URLs are derived from API_URL so they remain
  // consistent between production and local development.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  // Resend requires the FROM address to be on a verified domain OR to use
  // their sandbox address `onboarding@resend.dev` which works for any
  // account without setup. We default to the sandbox so email works out
  // of the box; swap to `noreply@yourdomain.com` after verifying a domain.
  EMAIL_FROM: z.string().default('Apex-Work <onboarding@resend.dev>'),

  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Web Push (VAPID). Generate once with:  npx web-push generate-vapid-keys
  // Public goes to the client (safe to expose). Subject must be a mailto: URL or https URL.
  VAPID_PUBLIC: z.string().optional(),
  VAPID_PRIVATE: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // Shared secret protecting /v1/cron/* — set to any 32+ char random string.
  CRON_TOKEN: z.string().optional(),

  // TURN relay for WebRTC. Free tier: sign up at metered.ca and paste the
  // API key here. Server fetches short-lived credentials on demand so the
  // long-lived TURN password never reaches the client. Without this,
  // group calls fall back to STUN-only and may fail on CGNAT networks.
  METERED_API_KEY: z.string().optional(),
  METERED_APP_NAME: z.string().default('apex_work'),

  SENTRY_DSN: z.string().optional(),

  // WebAuthn (passkeys / biometric login).
  // RP_ID must be the domain WITHOUT scheme or port (e.g. "apex-work-gold.vercel.app").
  // RP_ORIGIN is the full https origin the browser sees.
  // In dev, RP_ID='localhost' and RP_ORIGIN='http://localhost:3000'.
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_RP_NAME: z.string().default('Apex-Work'),
  WEBAUTHN_RP_ORIGIN: z.string().optional(),

  // Supabase Storage (files: portfolio, chat attachments, avatars)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
