# 🚀 Apex-Work

**Ethiopia's most powerful freelance marketplace for digital talent.**

Built with 100% open-source stack, free-tier services, and mobile-first design. Combines the best of Fiverr, Upwork, LinkedIn, and Telegram — reimagined for the Ethiopian market.

---

## ✨ Features

- 🇪🇹 **Ethiopia-first** — Amharic UI, Telebirr payments, local phone auth
- 🔑 **Flexible sign-in** — Phone/OTP, passkeys, Google, and GitHub OAuth with phone step-up for high-trust actions
- 📱 **Native app experience** — PWA with bottom navigation, offline support
- 💬 **Telegram-quality chat** — voice notes, files, real-time, encrypted
- 🤖 **AI-powered** — smart matching, proposal writer, live translation
- 💳 **Local payments** — Chapa (Telebirr, CBE Birr, HelloCash, Amole, cards)
- 🎨 **Beautiful UI** — shadcn/ui + Tailwind + micro-animations
- 🌗 **Dark & light mode**
- 🔐 **Secure** — JWT auth, bcrypt, rate limiting, CSRF, helmet

---

## 🏗️ Architecture

```
apex-work/  (npm workspaces monorepo)
├── apps/
│   ├── web/          → Next.js 14 (App Router) — PWA + landing
│   └── api/          → Express.js + TypeScript — REST API + WebSocket
├── packages/
│   └── shared/       → Shared types, validation schemas, constants
├── .github/
│   └── workflows/    → CI/CD pipelines
└── package.json      → Workspace root
```

### Tech Stack

**Frontend** (`apps/web`)
- Next.js 14 (App Router, RSC, Server Actions)
- TypeScript (strict)
- TailwindCSS + shadcn/ui + Radix
- Framer Motion (micro-animations)
- next-intl (Amharic / English / Oromo)
- TanStack Query (data fetching)
- Zustand (client state)
- next-pwa (installable app)
- react-hook-form + zod (forms)
- Sonner (toasts), Lucide (icons)

**Backend** (`apps/api`)
- Express.js + TypeScript
- Prisma ORM + PostgreSQL
- Redis (session, cache, pub/sub)
- Socket.io (real-time chat)
- Zod (validation)
- JWT auth (access + refresh)
- Argon2/bcrypt (password hashing)
- Helmet, CORS, rate-limit, compression
- Pino (structured logging)
- Vitest (tests)

**Shared** (`packages/shared`)
- Zod schemas (single source of truth)
- TypeScript types
- Constants (categories, currencies, roles)

**Infrastructure (Zero-cost tier)**
- Frontend: Vercel (free)
- Backend: Render (free, frankfurt) — note: free dynos sleep after idle
- Database: Neon (Postgres, 3GB free)
- Cache: Upstash Redis (10K cmd/day free)
- Storage: Supabase Storage (free)
- Email: Resend (3K/mo free)
- SMS: SMSEthiopia (pay-per-SMS, ET OTP delivery)
- Payments: Chapa (2.5% fee, no setup)
- AI: Groq / Gemini free tiers
- Monitoring: Sentry (5K events free)

---

## 🚀 Quick Start

### Prerequisites

- Node.js `24.x`
- npm `>=10.0.0`
- PostgreSQL running locally OR a Neon free-tier account
- Redis running locally OR an Upstash free-tier account

### 1. Clone & install

```bash
git clone https://github.com/Davezeni/Apex-work.git
cd Apex-work
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL, REDIS_URL, and other secrets
```

### 3. Set up database

```bash
npm run db:generate    # generate Prisma client
npm run db:migrate     # apply migrations
npm run db:seed        # (optional) seed sample data
```

### 4. Start dev servers

```bash
npm run dev
```

This starts:
- 🌐 Web: <http://localhost:3000>
- 🔌 API: <http://localhost:4000>

---

## 📜 Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start web + api in parallel |
| `npm run build` | Build all packages for production |
| `npm run test` | Run API unit tests (Vitest) |
| `npm run smoke:prod` | Check live web/API/payment endpoints |
| `npm run lint` | Lint all packages |
| `npm run typecheck` | Type-check all packages |
| `npm run format` | Format code with Prettier |
| `npm run db:migrate:deploy` | Apply pending migrations to the DB |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed the database |

---

## 🗂️ App Structure

**Web** (Next.js) — Two experiences in one:
- **Desktop / large screens** → Full landing page (marketing, discovery)
- **Mobile / small screens** → Native-feeling app with bottom nav

Routes:
```
/                      → Landing (desktop) / Home feed (mobile)
/login                 → Sign in
/signup                → Sign up
/onboarding            → New user setup
/browse                → Browse gigs & freelancers
/gigs/[id]             → Gig detail
/jobs/[id]             → Job detail
/u/[username]          → Freelancer profile
/messages              → Inbox
/messages/[id]         → Conversation
/saved                 → Account-backed saved gigs
/orders                → Orders list
/orders/[id]           → Order detail
/wallet                → Earnings & payouts
/profile               → My profile / edit
/settings/*            → Settings pages
```

---

## 🔐 Security Practices

- ✅ All secrets in `.env` (never committed)
- ✅ Passwords hashed with Argon2id (12 rounds)
- ✅ JWT access + refresh token rotation
- ✅ Rate limiting on all auth endpoints
- ✅ CSRF protection via SameSite cookies
- ✅ Helmet for security headers
- ✅ Input validation with Zod on every endpoint
- ✅ SQL injection safe via Prisma
- ✅ XSS-safe (React auto-escapes)
- ✅ CORS strictly whitelisted
- ✅ Prisma query complexity limits
- ✅ File upload validation (type, size, magic bytes)

---

## 🧪 Testing

```bash
npm run test            # unit tests (Vitest)
npm run test:coverage   # unit tests with coverage report (v8)
npm run test:e2e        # smoke Playwright tests against the live deploy
```

E2E is open-source Playwright and runs against the live web + API on CI pushes (catches a broken deploy). Install browsers once with `npm --workspace @apex-work/web run test:e2e:install`.

---

## 🚢 Deployment

Both services auto-deploy on push to `main`. See `docs/DEPLOY.md` for the full guide.

**Frontend (Vercel)** — `https://apex-work-gold.vercel.app`
- Repo root (the root `vercel.json` drives the monorepo build — do NOT set a sub-folder root).
- Env vars (must be set in the Vercel dashboard; `NEXT_PUBLIC_*` are baked in at build time):
  `NEXT_PUBLIC_API_URL` (→ `https://apex-work-api.onrender.com`), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_CHAPA_PUBLIC_KEY`.

**Backend (Render)** — `https://apex-work-api.onrender.com`
- The tracked `render.yaml` blueprint drives provisioning + deploy.
- Prisma migrations are applied automatically on every deploy via `preDeployCommand`.
- Secrets (DB URL, Redis, JWT, Chapa, SMSEthiopia, OAuth, Supabase, Groq, VAPID, CRON_TOKEN, METERED) live in the Render dashboard, never in the repo.

---

## 📝 License

Proprietary — © 2026 Apex-Work

---

## 👥 Contributing

Internal team only. Follow the conventions in `docs/CONTRIBUTING.md`.

**Made with 🇪🇹 in Addis Ababa**
