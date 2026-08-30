# Changelog

All notable changes to Apex-Work will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — Test coverage expansion (free OSS)

### Added
- **+10 unit tests** for the validation middleware, response helpers and the
  moderation service (gig unflag, job pin/open toggle, review hide/restore) —
  78 → 88 tests.
- **Admin UI e2e guards** (`apps/web/e2e/admin.spec.ts`): verifies the admin
  route is gated (unauthenticated → login redirect), the login page renders,
  and unauthenticated API access to `/admin/ops/*` returns 401. Authenticated
  admin actions are opt-in behind `E2E_ADMIN_PHONE`/`E2E_ADMIN_OTP`.

## [Unreleased] — Security & quality hardening (free OSS)

### Added
- **Secret scanning** (`.github/workflows/ci.yml`): a `gitleaks` job scans the
  full git history on every push/PR so a leaked credential can't slip in.
- **Dependabot** (`.github/dependabot.yml`): weekly npm + GitHub Actions dep
  updates (patch/minor only — majors are held back by default).
- **More unit tests** covering the new admin surface: settings store validation
  & attribution, audit helper (fire-and-forget), admin cursor pagination, and
  RBAC `requireCapability` middleware (60 → 78 tests).

### Changed
- `vitest.config.ts` coverage threshold updated; test file type safety fixed.

## [Unreleased] — Order workflow correctness, testing & tooling

### Added
- **Order state machine** (`shared/domain/orderState.ts`): a single, tested DAG
  of legal transitions (`PENDING → ACTIVE → IN_REVIEW → COMPLETED`, with
  revision, cancel and dispute edges). `orders.service.ts` now routes every
  mutation through `assertOrderTransition`, so illegal moves are rejected
  consistently (previously scattered `if/else` checks).
- **Money** (`shared/domain/money.ts`): `computeOrderSplit` + `isValidGigPrice`
  are the single source of truth for platform economics (integer-ETB fee split,
  seller always gets gross − fee). `orders.service.ts` uses it.
- **Real test tooling** (all open-source):
  - `npm run test:coverage` (Vitest v8 coverage) with a CI floor threshold.
  - `npm run test:e2e` (Playwright) — installs a browser, checks the live web +
    API smoke surface, and runs on CI pushes to catch a broken deploy.
- CI job (`.github/workflows/ci.yml`) e2e smoke against the live deploy.
- 11 new unit tests for the order state machine + money split (49 → 60 tests).

### Changed
- `orders.service.ts` guards now emit the reason from the transition map, and
  fee math delegates to `computeOrderSplit`.
- README documents the real `test:coverage` / `test:e2e` scripts.

## [Unreleased] — Admin control surface (RBAC, moderation, money, ops)

### Added
- **RBAC** (`lib/adminRbac.ts` + `middleware/adminOnly.ts`): admin capabilities
  map with `ADMIN` (super), `MODERATOR`, `SUPPORT`, `FINANCE`. Staff roles are
  enforced server-side via `requireCapability()`; the admin UI filters its nav
  and only shows tabs a role may use. `UserRole` extended with the three staff
  roles.
- **New admin endpoints** under `/admin/ops`, each capability-guarded:
  - Moderation: gigs (`moderate`/`feature`/`unfeature`), jobs, reviews
    (hide/restore), agencies.
  - Money: orders board + refunds, wallet ledger + manual adjustment,
    withdrawals (status ops).
  - Community: users (list/detail, suspend, role change, ID verify), admin
    roles list.
  - Support: ticket queue (list/detail/reply/status).
  - Promotions: broadcast announcement, featured gigs.
  - Subscriptions: list. Settings: typed key/value platform config + feature
    flags. Ops: analytics summary, audit log.
- **Audit trail**: every admin mutation is recorded to `AdminAuditLog`
  (who/what/before/after/when/ip) via `lib/audit.ts`. The admin panel exposes it
  under the "Audit log" tab.
- **Cursor pagination** (`lib/cursor.ts`, `lib/adminPage.ts`): keyset pagination
  for all admin list endpoints (opaque, base64url, index-friendly).
- **Settings store** (`AppSetting`): runtime-tunable platform fee, limits and
  feature flags, edited only by admins.
- **Schema** (`20260830100000_admin_ops`): `AdminAuditLog`, `AppSetting`,
  `Review` moderation fields, `Gig` flag/pin fields, `Job.pinnedAt`, extra
  `UserRole` + `TransactionType` enum values.
- Admin tabs: Moderation, Orders & Money, Support, Promotions, Subscriptions,
  Settings, Audit log, Admin team (replacing the previous 7-tab surface).
- Unit tests for RBAC and cursor pagination (39 → 49 tests).

### Changed
- Legacy `admin.routes.ts` endpoints are now capability-scoped (reports,
  withdrawals, users, skills, certs, diagnostics, disputes) so a non-super
  staff role can't reach money or user-suspend by accident.

## [Unreleased] — Deployment & hardening

### Changed

- **Render:** `render.yaml` now runs Prisma migrations automatically on every
  deploy via `preDeployCommand` (`npm run db:migrate:deploy`, using the direct
  `DATABASE_URL_UNPOOLED` when present). Previously migrations were only applied
  manually, so a build could ship a new schema against a stale DB.
- **Rate limiting:** auth/OTP/PIN/API limiters now fall back to a local
  in-memory counter during a Redis outage instead of silently disabling limits.
  This keeps brute-force throttling alive even when Redis is down (per-instance
  while degraded); limits return to the shared store automatically on reconnect.
- **CORS:** rejected origins now return a clean `403 Forbidden` instead of a
  generic `500`, so expected cross-origin rejections stop polluting server-error
  logs.
- **Docs & env:** `.env.example` regenerated to exactly match
  `apps/api/src/config/env.ts` (shipped Supabase Storage instead of the dead
  Cloudflare R2 keys, and added the previously missing WebAuthn, VAPID,
  CRON_TOKEN and METERED vars). `README.md` and `docs/DEPLOY.md` reconciled with
  the real Render + Vercel + Supabase architecture (they previously described
  Koyeb + Cloudflare R2).
- **Docs:** README no longer advertises `test:e2e`/`test:coverage` scripts that
  did not exist.

## [0.3.1] — 2026-08-28 — OAuth phone step-up

### Changed

- Google/GitHub users can create a basic account without repeating phone OTP during OAuth signup.
- Existing OAuth accounts without a verified phone are sent to `/settings/phone` after sign-in.
- Ethiopian phone OTP remains mandatory for phone-based signup.
- High-trust actions require a verified phone: posting gigs/jobs, ordering, messaging, offers, groups, and withdrawals.
- Added a phone verification page and authenticated phone binding endpoint.
- Made the User phone field nullable for OAuth-created accounts while keeping it unique when present.

### Database

- Applied migration `20260828200000_oauth_phone_step_up` to production Neon.

## [0.3.0] — 2026-08-28 — Google and GitHub sign-in

### Added

- OAuth start/callback flow for Google and GitHub with Redis-backed single-use state.
- One-time token handoff from API to web so access/refresh tokens never travel in the redirect URL.
- Existing accounts link by verified provider email; new OAuth users must verify an Ethiopian phone number before signup completes.
- Provider identity records stored without access tokens.
- Login and signup buttons for Google and GitHub.
- OAuth callback page and safe internal redirect validation.
- OAuth provider credentials documented as Render API environment variables.

### Security

- Provider secrets remain server-side only.
- OAuth state, pending signup tokens, and session handoffs expire and are single-use.
- Google/GitHub OAuth does not bypass phone verification for new accounts.

## [0.2.2] — 2026-08-28 — Account-synced notification controls

### Added

- Account-level notification preferences for messages, orders, reviews, payments, promotions, and system alerts.
- Durable preference API at `/v1/me/notification-preferences`.
- Notification delivery now respects saved categories while failing open if preference lookup is unavailable.
- Notification settings are synchronized across devices instead of stored only in browser localStorage.

### Database

- Added nullable `User.notificationPrefsJson`; safe defaults apply to existing accounts.
- Applied migration `20260828150000_notification_preferences` to production Neon.

## [0.2.1] — 2026-08-28 — Chapa checkout and payout safety

### Fixed

- Chapa webhooks now preserve raw request bytes for signature verification.
- Both Chapa signature header variants and nested transaction references are accepted.
- Production gig, job-bid, and offer flows no longer leave unpaid orders behind when Chapa is unavailable or initialization fails.
- Checkout options now report live Chapa status instead of storing fake payment details in browser localStorage.

### Added

- Explicitly opt-in Chapa Transfers integration with bank-list lookup and processing-status reconciliation.
- `/v1/cron/withdrawals` is available for scheduled transfer reconciliation; automated transfers remain disabled until sandbox verification.

## [0.2.0] — 2026-08-28 — Account-backed saved gigs

### Added

- Persistent saved gigs stored per account in PostgreSQL.
- Idempotent save/unsave API operations and a per-gig status endpoint.
- Saved Gigs page at `/saved`, linked from the profile menu.
- Archived or paused saved services remain visible instead of disappearing silently.
- Gig detail heart state now syncs across browsers and devices instead of using browser-only localStorage.

### Database

- Added `SavedGig` with a unique `(userId, gigId)` constraint and cascade cleanup.
- Applied migration `20260828090000_saved_gigs` to the production Neon database.

## [0.1.0] — 2026-08-20 — MVP Core Scaffold

### Added

**Monorepo**
- npm workspaces (`apps/web`, `apps/api`, `packages/shared`)
- Shared TS config, Prettier, EditorConfig
- GitHub Actions CI (lint, typecheck, build)

**Shared package** (`@apex-work/shared`)
- Zod validation schemas (auth, user, gig, common)
- TypeScript types (ApiResult, Paginated)
- Constants (categories, roles, payment methods, rate limits, phone regex)

**API** (`@apex-work/api`)
- Express 4 + TypeScript with strict mode
- Prisma schema for full data model:
  - Users, roles, sessions, refresh tokens
  - Skills, portfolio, gigs & gig packages
  - Jobs, bids
  - Orders, payments, wallets, transactions
  - Reviews, conversations, messages
  - Notifications
- Auth service:
  - Phone + OTP flow (Ethiopian phone regex)
  - Refresh-token rotation with revocation & reuse detection
  - Argon2id password hashing
- Middleware:
  - `validate` (Zod)
  - `requireAuth` / `requireRole` / `optionalAuth`
  - Redis-backed rate limits (auth, otp, api)
  - Global error handler (Zod, Prisma, AppError)
- Routes:
  - `/v1/auth/*` — OTP request/verify, signup, login (password + OTP), refresh, logout
  - `/v1/me` — get / update profile
  - `/v1/gigs` — cursor-paginated list + detail
- Socket.io realtime layer with JWT handshake auth
- Structured logging (pino) with redaction
- Graceful shutdown handlers
- SMS abstraction (AfroMessage + console dev provider)
- Prisma seed with demo user and gig

**Web** (`@apex-work/web`)
- Next.js 14 (App Router, RSC)
- Tailwind CSS + shadcn-style Button/Card/Avatar
- Framer Motion for micro-animations
- Zustand auth store with localStorage persistence
- TanStack Query provider
- next-themes dark/light with system detection
- **Dual UI experience**:
  - **Desktop landing** — hero, categories, featured freelancers, CTA
  - **Mobile app shell** — bottom nav (5 tabs incl. FAB), gesture-friendly sheets (vaul)
- Pages:
  - `/` — home (desktop landing or mobile home)
  - `/login` — phone + OTP with animated step transitions
  - `/signup` — 4-step wizard (role → phone → OTP → name)
  - `/search` — mobile search screen
  - `/messages` — inbox with unread badges, typing indicator
  - `/profile` — profile with wallet card, stats, menu
- PWA manifest + gradient icon
- Haptic feedback on tap (via navigator.vibrate)

**Documentation**
- Root README with setup instructions
- `docs/ARCHITECTURE.md` — system diagram, data flow, security, auth flow
- `docs/CONTRIBUTING.md` — branch strategy, commits, PR checklist, coding standards
- Per-package READMEs

### Security

- Argon2id (memory-hard) for passwords, OWASP 2024 params
- SHA-256 for OTPs and refresh-token bookkeeping
- Cryptographically-secure OTP generation
- JWT access (15m) + refresh (30d) with rotation
- Rate limits: 10 auth / 15 min, 5 OTPs / hour, 200 API / 15 min
- Constant-time password verification against dummy hash (prevents user enumeration)
- Helmet, CORS allowlist, `trust proxy`, size limits
- Zod validation on every input
- Env schema validation (fail-fast startup)

### Known TODOs (post-MVP)

- Chat routes/services (Socket.io wired but persistence pending)
- Chapa payment integration
- Order lifecycle endpoints
- File upload (R2 presigned URLs)
- next-intl locale wiring for Amharic UI
- Playwright E2E tests
- Sentry error reporting
