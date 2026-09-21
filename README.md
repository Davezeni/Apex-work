# 🚀 Apex-Work

**Ethiopia's most powerful freelance marketplace for digital talent.**

Built with a 100% open-source stack, free-tier services, and mobile-first design. Combines the best of Fiverr, Upwork, LinkedIn, and Telegram — reimagined for the Ethiopian market.

- 🌐 **Web app:** https://apex-work-gold.vercel.app
- 🔌 **API:** https://apex-work-api.onrender.com/v1/health

---

## ✨ Features

### Marketplace
- **Gigs** — freelancers publish fixed-price service packages with tiers, images and delivery estimates; clients browse a role-pure catalog, save, and order.
- **Jobs & bidding** — clients post jobs; freelancers bid with cover letters, budget and timeline. Team/agency accounts can place **crew bids** (bid on behalf of a team with member chips).
- **Orders & escrow** — client funds are held in escrow via **Chapa** (Telebirr, CBE Birr, HelloCash, Amole, cards); delivery → review → release flow with **auto-release cron** for silent clients, per-event **idempotency ledger** (double-payout is impossible by schema), and partial refunds.
- **Milestones** — large orders split into milestone payments with independent escrow/release.
- **Teams & agencies** — freelancer teams with **payout-share splits** (`splitPayout`), owner commission snapshot at assignment, and atomic multi-party payouts on every release path.
- **Offers** — direct custom offers from freelancer to client.
- **Reviews & disputes** — double-blind reviews; a full dispute flow with admin arbitration.
- **Wallet** — ETB balance, deposits, withdrawals (Chapa Transfers), and a complete ledger.
- **Referrals** — invite links with per-signup ETB rewards.
- **Subscriptions** — FREELANCER_PRO / CLIENT_PRO plans via Chapa.

### Communication
- **Telegram-quality chat** — Socket.io realtime, voice notes (recorded in-browser, transcribed by Whisper), file/image sharing, reactions, typing indicators, unread counters, group chats.
- **Web Push notifications** (VAPID) + in-app notification center.
- **AI assistant & smart replies** — chat copilot, message translation (live EN⇄AM), suggested replies.

### AI (Groq / Llama 3.3 70B)
- **AI Proposal writer** — job-description-aware proposal generation.
- **AI CV extraction** — upload a CV (PDF/DOCX/TXT/photo-OCR) and a prompted LLM identifies every field (name, contact, summary, experience, education, certifications, skills, languages, achievements, interests, projects); a semantic sanitizer rescues mis-filed values into the right fields; results are schema-clamped so imports always save; deterministic heuristic parser as fallback; the review screen shows which engine ran and why.
- **Resume Studio AI** — summary/section enhancement, ATS-style CV review, job-description tailoring.
- **Portfolio case-study generator**, **gig translation**, **AI brief builder**.
- All AI responses are Redis-cached (600s) and rate-limited separately.

### Identity & CV
- **Resume Studio** — multiple templates (incl. premium unlocks purchased via Chapa), live PDF/DOCX export, version snapshots with restore, public shareable CV pages.
- **Smart CV import** — file upload, photo OCR (Tesseract, EN+AM), or paste; server-side PDF/DOCX text extraction; AI or heuristic structuring; section-by-section editable review; additive duplicate-safe import with server-side verification and an exact receipt.
- **Portfolio** — rich case studies with images and tech tags.

### Ethiopia-first UX
- 🇪🇹 **Languages** — English, Amharic (አማርኛ), Afaan Oromoo, Tigrinya — full UI translation with auto-dictionary.
- 📱 **PWA** — installable, offline-capable shell, mobile bottom navigation, safe-area aware.
- 🧭 **Nearby freelancers** — Leaflet map with geo search.
- 💳 **Local payments** — Chapa covers all major Ethiopian rails.
- 🔔 **SMS OTP** via SMSEthiopia (direct local route, ETB billing).

---

## 🏗️ Architecture

```
apex-work/  (npm workspaces monorepo)
├── apps/
│   ├── web/          → Next.js 14 (App Router) — PWA, SSR landing + client app
│   └── api/          → Express + TypeScript — REST /v1 API + Socket.io
├── packages/
│   └── shared/       → zod schemas, domain logic, i18n dicts (single source of truth)
├── render.yaml       → API infra-as-code (free tier, build-time migrations)
└── .github/          → CI (gitleaks, audit, lint, typecheck, test, build) + Dependabot
```

**Data model:** 58 Prisma models (users, profiles, gigs, jobs, bids, orders, milestones, escrow events, ledger entries, wallets, messages, conversations, reviews, disputes, resumes, CV entities, agencies, referrals, subscriptions, notifications, devices, support tickets, …), PostgreSQL with 95+ indexes.

**API surface:** 45+ route modules under `/v1` — auth, users, gigs, jobs, orders, milestones, payments, wallet, chat, notifications, AI, resume, portfolio, agencies, referrals, subscriptions, admin, moderation, support, geo, search, recommendations, uploads, push, passkeys, cron, and more. Every request validates through zod schemas shared verbatim with the web client.

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| Web | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/radix UI, Framer Motion, Zustand, TanStack Query, TipTap, Leaflet, Tesseract.js, html2pdf/docx export |
| API | Node 24, Express, TypeScript, Socket.io, Prisma ORM |
| Database | PostgreSQL (Render), pooled + unpooled connections (PgBouncer), build-time `migrate deploy` |
| Cache / rate limits | Redis (ioredis + rate-limit-redis) |
| AI | Groq — Llama 3.3 70B (generation), Whisper large-v3-turbo (voice transcription) |
| Payments | Chapa (checkout, webhooks, transfers) |
| Email / SMS / Push | Resend · SMSEthiopia · Web Push (VAPID) |
| Auth | JWT (15m access + 30d rotation), bcrypt(12), phone OTP, Google & GitHub OAuth, **WebAuthn passkeys** |
| Observability | Sentry (API + web), pino structured logs, PostHog analytics, uptime health endpoint |
| QA | Vitest (296 unit/integration tests), Playwright e2e, ESLint (0-warning policy), prettier |
| CI/CD | GitHub Actions: gitleaks secret scan → dependency audit → lint+typecheck → tests → build; auto-deploy to Vercel (web) & Render (api) on push |

## 🚢 Deployment

- **Web → Vercel** (edge CDN, preview deploys per PR, instant rollbacks).
- **API → Render** (free tier): **migrations run inside the build command** (last step) so a failed migration fails the build — no schema-ahead releases. Render `preDeployCommand` is paid-only and therefore deliberately unused.
- **Infra as code:** `render.yaml` (env, build, health check).
- **Keep-alive:** external cron warms the API to soften free-tier cold starts.
- Version markers (`APP_UI_BUILD`) are embedded in admin/messages bundles so live deploys are externally verifiable.

## 🔐 Security measures

- **Headers:** helmet — HSTS (31536000, subdomains), X-Frame-Options, nosniff, referrer-policy (verified live).
- **TLS** everywhere, auto-managed certificates (Google Trust Services).
- **AuthN:** bcrypt(12) password hashing; short-lived JWTs with refresh rotation and device tracking; WebAuthn passkeys; OAuth; phone step-up verification for sensitive actions; auth-lite sessions invalidate on password change.
- **AuthZ:** route-level `requireAuth`, `adminOnly` RBAC middleware; ownership checks in services; admin deletion protects ADMIN accounts.
- **Input validation:** every body/params/query validated by shared zod schemas (same package on client & server); strict file-type allowlists on uploads.
- **SQL injection:** Prisma parameterized queries only — no raw string SQL (live probe → blocked).
- **XSS:** React escaping; zero reflected script probes; CSP-conscious rendering.
- **SSRF:** `lib/safeUrl.ts` — scheme allowlist, userinfo rejection, private-hostname block, **all-IPv4-literal block**, DNS-resolution check (defeats `nip.io`/rebinding), applied to user-influenced fetches (voice transcription, link previews incl. every redirect hop). Fail-closed on private addresses.
- **Rate limiting:** Redis-backed, per-route and global (300 req/15 min default, `RateLimit-*` headers on every response), tighter budgets on auth/AI/OTP endpoints.
- **Payments integrity:** Chapa webhook signature verification **and** transaction re-verification against Chapa's API (never trust the payload); idempotency keys on financial events; unique `(user, type, relatedId)` ledger prevents double-credits; escrow splits are atomic.
- **Secrets:** dashboard-injected env vars only; `gitleaks` scans every CI run; tokens used in ops are single-use and wiped.
- **Supply chain:** `npm audit --omit=dev --audit-level=high` gate + weekly Dependabot (grouped minor/patch).
- **AI safety:** extraction outputs are type-coerced **and** semantically sanitized; the model can only emit structured data that passes the same zod schemas — it cannot execute anything or bypass validation.

## ⚡ Performance

- Indexed-first design (95+ indexes, composite + partial where hot).
- Redis caching: AI responses, link previews, hot reads; client-side query cache with precise invalidation.
- Connection pooling via PgBouncer (pooled for runtime, unpooled for migrations).
- Compression middleware; paginated endpoints with cursor/offset discipline; `N+1`-aware Prisma includes.
- Edge-cached static/web assets via Vercel CDN; immutable hashed bundles.
- Socket.io realtime avoids polling; notifications are pushed (Web Push) not fetched.
- Free-tier trade-offs (accepted): API cold starts after ~15 min idle (softened by keep-alive pings), shared CPU. Horizontal-scale path: stateless API + Redis adapter for Socket.io.

## 🧪 Quality gates

Every push runs: secret scan → dependency audit → lint (max-warnings=0) → typecheck (web + api) → 296 vitest tests → production builds. PRs cannot merge red. Before every release the workspace runs the same gates locally, plus empty-file guards and served-chunk verification of the live deploy.

## 🗺️ Known limitations & roadmap

- Free-tier ceilings: Postgres expiry window, cold starts, 512 MB RAM — migrate to paid Render/Railway or a VPS when revenue justifies.
- SMS is single-provider (SMSEthiopia) by design — redundancy was removed for operational simplicity; finish sender-ID approval + wallet top-up for full delivery.
- Sentry alerts activate the moment `SENTRY_DSN` is set on Render (code fully wired).
- See `SECURITY_AUDIT.md` for the current assessment.

## 🧑‍💻 Local development

```bash
npm install            # installs workspaces, builds shared, generates Prisma client
cp apps/api/.env.example apps/api/.env   # fill in DATABASE_URL, JWT_SECRET, REDIS_URL…
npm run db:migrate && npm run db:seed
npm run dev            # web :3000 + api :4000, parallel
npm test               # shared build → prisma generate → vitest
```

---

*Apex-Work — build, hire, get paid. In Ethiopia. In birr.*
