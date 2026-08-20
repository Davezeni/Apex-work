# Architecture

## High-level

```
                       ┌────────────────────────┐
                       │      Cloudflare        │
                       │   CDN + WAF (free)     │
                       └────────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
     ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐
     │  Vercel (free)  │  │  Koyeb (free)    │  │  Cloudflare R2     │
     │  Next.js 14     │  │  Express + Socket│  │  (S3-compatible)   │
     │  PWA            │  │  .io             │  │  files/media       │
     └────────┬────────┘  └────────┬─────────┘  └────────────────────┘
              │                    │
              └─────────┬──────────┘
                        ▼
     ┌──────────────────────────────────────────────────────┐
     │                  Neon (Postgres)                      │
     │                  Upstash (Redis)                      │
     │       Chapa (payments)  ·  AfroMessage (SMS)          │
     │        Groq / Gemini (AI, free tiers)                │
     └──────────────────────────────────────────────────────┘
```

## Monorepo layout

- `apps/web` — Next.js 14 app (SSR + PWA). Deploys to Vercel.
- `apps/api` — Express + TS + Prisma + Socket.io. Deploys to Koyeb/Fly.
- `packages/shared` — Zod schemas, TS types, constants shared across both.

## Data flow

1. **Client** (Next.js) calls `apiFetch()` from `lib/api.ts`.
2. Request hits `/v1/*` on API with `Bearer <accessToken>`.
3. API validates via `validate(schema)` middleware (Zod).
4. Route handler delegates to a **service** (e.g. `services/auth.service.ts`).
5. Service uses Prisma + Redis; throws typed `AppError` on failure.
6. Errors bubble to `errorHandler` middleware which serializes them.
7. Client receives `{ ok: true, data }` or `{ ok: false, error: {...} }`.

## Auth flow (phone + OTP)

```
1. POST /auth/otp/request  { phone, purpose }
       -> generates 6-digit code, hashes, stores in DB, sends via SMS
2. POST /auth/otp/verify   { phone, code }
       -> validates code (hash compare), issues short-lived verifiedToken
3. POST /auth/signup       { phone, otpToken, fullName, role }
       OR
   POST /auth/login/otp    { otpToken }
       -> creates/loads user, issues { accessToken, refreshToken }
4. Refresh flow:
   POST /auth/refresh      { refreshToken }
       -> verifies JWT signature, checks DB (hash), rotates token
5. Logout:
   POST /auth/logout       { refreshToken }
       -> marks token revoked
```

Access tokens: 15 min. Refresh tokens: 30 days, rotated on each refresh.

## Security

- Argon2id for passwords, SHA-256 for OTPs / refresh-token bookkeeping.
- Rate limiting via Redis (10 auth attempts / 15 min, 5 OTPs / hour).
- Helmet + strict CORS + `trust proxy` for accurate client IP.
- Input validation on every endpoint via Zod.
- Prisma prevents SQL injection.
- No secrets in the repo; `.env.example` shows what's needed.

## Real-time (Socket.io)

- Authed via `handshake.auth.token` (JWT).
- Rooms:
  - `user:<userId>` — private, for direct notifications
  - `conv:<conversationId>` — for chat messages, typing, presence
- Redis adapter attaches when available for multi-node scale.

## Rendering strategy (web)

- `/` is a client component that uses `useIsMobile()` to decide:
  - Desktop → `<DesktopLanding />` (marketing).
  - Mobile → `<MobileShell><MobileHome /></MobileShell>` (native-feeling).
- All app pages (`/search`, `/messages`, `/profile`) use `<MobileShell>` on
  small screens, with a bottom nav + FAB.
- PWA-ready via `manifest.webmanifest` + `viewport-fit: cover`.
