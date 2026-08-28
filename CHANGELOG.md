# Changelog

All notable changes to Apex-Work will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
