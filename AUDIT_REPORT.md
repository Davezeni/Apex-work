# Apex-Work — Codebase & Deployment Audit

**Audited:** 2026-08-30 · Repo: `Davezeni/Apex-work` (main) · Both deployments verified live.

---

## ⚠️ 0. Urgent: revoke the GitHub token you shared

You pasted a personal access token (`ghp_...`) into this chat so I could clone the repo. Even though it went to me, **treat it as compromised and revoke it** — tokens pasted into chats can end up in logs, transcripts, or screenshots.

→ GitHub → Settings → Developer settings → Personal access tokens → **Revoke / delete it now.** Generate a new one when needed, and prefer a **fine-grained** token scoped to just this repo, read-only, short expiry.

---

## 1. What this project is (what I understand)

**Apex-Work** is an Ethiopia-first freelance marketplace — a hybrid of Fiverr + Upwork + LinkedIn + Telegram, with local OTP/phone auth, Telebirr/Chapa payments, Amharic/English/Oromo i18n, PWA, chat, AI, resume studio, and Pro/agency features.

**Monorepo** (npm workspaces):

```
apex-work/
├── apps/web      → Next.js 16 (App Router) · React 19 · Tailwind/shadcn · 170 src files
├── apps/api      → Express 4 + TypeScript · Prisma · Socket.io · ~50 route modules · ~65 services
├── packages/shared → zod schemas, types, constants (single source of truth)
├── .github/workflows → CI, cron (15-min), warmup (5-min)
└── render.yaml · vercel.json · .env.example
```

**Scale:** 51 Prisma models, ~40+ route namespaces, 8 test files, 20 tracked migrations, 47+ custom indexes.

**Live infra (confirmed by curl):**
- API → Render free, `https://apex-work-api.onrender.com` (health + ready **200**, DB & Redis **ok**)
- Web → Vercel, `https://apex-work-gold.vercel.app` (home **200**)
- Neon Postgres, Upstash Redis, Chapa, AfroMessage, Supabase Storage, Groq, WebPush, WebAuthn, OAuth

Both services are **actually running** — this is a real, working product, not a scaffold.

---

## 2. What has been done **correctly** ✅ (genuinely good engineering)

1. **Strict env validation** — `config/env.ts` uses zod; fails fast on missing/invalid vars, with sensible production defaults (e.g. `API_URL` defaults to the onrender URL in prod so Chapa callbacks never fall back to localhost).
2. **Secrets never committed** — clean grep of files *and* full git history: no `.env`, no `AKIA`, no private keys, no `ghp_`. `.gitignore` correctly excludes all env variants. Only `.env.example` is tracked. **This is the rare thing most projects get wrong — it's right here.**
3. **Defense-in-depth auth** — JWT access/refresh with type discrimination (`access` vs `refresh`) and token-id (`jti`) rotation; admin routes **re-read the role from the DB** rather than trusting the JWT claim; OAuth stored without access tokens.
4. **Correct webhook ordering** — Chapa webhook is parsed as `express.raw` **before** `express.json()`, so the raw body is available for signature verification. This is a subtle, commonly-broken detail they got right.
5. **Graceful degradation everywhere** — rate limiter skips (not 500s) if Redis is down; AI falls back to a deterministic generator if Groq is down; health endpoint never touches Redis/DB; socket init failure doesn't kill the API.
6. **Readiness vs liveness split** — `/v1/health` (always up) vs `/v1/ready` (pings DB+Redis). Correct separation.
7. **Security headers & hardening** — helmet, `x-powered-by` disabled, strict CORS allowlist, body size limits, strong ETag, compression, `trust proxy` for reverse proxies.
8. **Migration hygiene** — 20 versioned Prisma migrations, declarative indexes, `@@unique`/`@@index` on hot fields.
9. **Free-tier ops thinking** — documented keep-alive strategy (in-process self-ping + GitHub-Actions external ping every 5 min), cron-token-protected `/v1/cron/tick`, Redis reconnect heartbeat. Someone clearly knows Render/Vercel free-tier quirks.
10. **Typed API client** — `lib/api.ts` is a clean typed fetch wrapper; `NEXT_PUBLIC_API_URL` falls back to the prod API URL in production, so it can't silently point at localhost.
11. **CI/CD coverage** — lint, typecheck, format-check, unit tests, and a production build gate in CI; `--webpack` on Next 16 is a valid documented opt-out; `apps/api` excluded from Vercel via `.vercelignore`.
12. **Good doc comments** — each non-obvious decision (webhook ordering, passkey RP origin, storage proxy, PIN brute-force limiter) has a rationale comment. The CHANGELOG is disciplined (Keep a Changelog).

---

## 3. What is **NOT** done / is wrong ⚠️ (by impact)

### A. Confirmed cold-start problem (highest impact — I measured it)
Live test: `GET https://apex-work-api.onrender.com/v1/health` returned **HTTP 200 after 32.4s**, and the health body showed `uptime: 17` seconds — i.e. **the dyno had just cold-started**. For a marketplace, a 30+ second first-request latency is a hard user-facing failure (app "hangs" then loads).

This means the keep-alive/warmup strategy is **not actually preventing cold starts**, even though GitHub Actions pings every 5 min. Likely causes to investigate:
- GitHub Actions **scheduled** workflows aren't guaranteed to fire on the exact minute and can be paused/disabled.
- Render free Web Services sleep after ~15 min of no **inbound public** traffic; an internal `127.0.0.1` self-ping may not count as activity.
- The warmup job hits `/v1/ping`, but if the dyno was already asleep it still pays the cold start — the warmup only helps if it fires *while* the dyno is up.

**Action:** Either move the API to an always-on instance (Render Starter, or Koyeb/Fly/Hetzner), or make the external warmup bulletproof (a real UptimeRobot/cron job from outside GitHub), and monitor it. The current warmup gives ~99% but measured reality says it sleeps.

### B. `render.yaml` never applies migrations — and the docs claim it does
`docs/DB_STATUS.md` says *"Render auto-runs this on every build (see render.yaml)"* — **false.** The `render.yaml` `buildCommand` runs `npm ci`, build shared, `prisma generate`, build API. There is **no `preDeployCommand`** and no `npm run db:migrate:deploy` anywhere in the file.

So on every future deploy, **migrations are not applied automatically**. Today it works only because migrations were run manually. The moment someone adds a new migration and deploys, production will be out of sync (or break, since `prisma generate` generates a client for the *new* schema against an *old* DB).

**Action:** Add to `render.yaml`:
```yaml
preDeployCommand: npm --workspace @apex-work/api run db:migrate:deploy
```
(and fix the doc).

### C. Documentation/config drift — 3 places disagree
| Topic | README / DEPLOY.md says | Reality (render.yaml + live) |
|---|---|---|
| API host | **Koyeb** (`apex-work-api.koyeb.app`) | **Render** (`apex-work-api.onrender.com`) |
| Storage | Cloudflare **R2** | **Supabase Storage** |
| Web domain | `apex-work.vercel.app` | `apex-work-gold.vercel.app` |
| Backend target | "Koyeb / Fly.io" | Render |

The docs and the shipped config describe **different stacks**. Anyone on-boarding or debugging is misled. **Action:** rewrite README + DEPLOY.md to match the real Render + Vercel + Supabase setup.

### D. `.env.example` is out of date and would silently break file uploads
`config/env.ts` reads **Supabase** vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`) plus `VAPID_*`, `CRON_TOKEN`, `WEBAUTHN_*`, `METERED_API_KEY`.

But `.env.example` documents the **old** provider: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, etc. — none of which the code reads.

**Consequence:** a new dev copies `.env.example`, fills in R2 keys, and file uploads return *"File uploads are not configured on this environment"* because the code looks for Supabase. **Action:** regenerate `.env.example` directly from the `envSchema` keys (R2, Supabase, VAPID, CRON_TOKEN, WEBAUTHN, METERED).

### E. CORS rejection returns HTTP 500 (minor but wrong)
`app.ts` does `cb(new Error('CORS: origin not allowed'))` → the browser is blocked (good) but the API returns **500** to the offending origin and floods logs, instead of a clean `403`. **Action:** respond `403` and just omit the `Access-Control-Allow-Origin` header, or return the error as a 4xx.

### F. Testing gaps vs. what's claimed
- Only **8 test files** (mostly service-level, mocked), for 51 models + ~50 routes — large untested surface.
- README advertises `npm run test:e2e` and `npm run test:coverage`, **but neither script exists** in any `package.json`. There's no Playwright setup despite the README. **Action:** either add real e2e + coverage scripts, or remove the claims.

### G. Security trade-off worth acknowledging
Rate limiting **silently disables itself when Redis is down** (`skip: () => redis.status !== 'ready'`). Good for uptime, but means auth endpoints can become unthrottled during a Redis outage — exactly when brute-force risk rises. Documented as intentional, but consider a fallback in-memory limiter for auth OTP/PIN paths specifically.

### H. Minor / hygiene
- `CHAPA_TRANSFERS_ENABLED` rightly defaults `false` (payouts off until verified) — good, just remember to enable deliberately.
- `SUPABASE_URL` (project endpoint) is committed in `render.yaml` — that's a non-secret identifier, but it's cleaner to keep it with the other `sync: false` dashboard vars.
- No Sentry/PostHog configured despite `.env.example` listing them (optional, non-blocking).
- `update: 2026-08-30` — web returns 200 but I did not validate every auth'd route; only representative public/health endpoints.

---

## 4. Render + Vercel config & `.env` — what they *truly* say

### Render (`render.yaml`)
- **Service:** `web`, runtime `node`, **plan: free** (512 MB, sleeps after ~15 min idle), **region: frankfurt**, branch `main`, `autoDeploy: true`.
- **Build:** `npm ci --include=dev` → build `@apex-work/shared` → `prisma generate` → build API.
- **Start:** `node apps/api/dist/server.js` (reads `PORT` from Render).
- **Health:** `GET /v1/health` (matches `app.ts` — and correctly bypasses the rate limiter).
- **Env contract:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `REDIS_URL`, `JWT_SECRET`(`generateValue`), Chapa keys, AfroMessage keys, OAuth ids/secrets, Supabase keys, Groq, VAPID, `CRON_TOKEN`, `METERED_API_KEY` — with `CORS_ORIGINS`, `WEB_URL`, `API_URL`, WebAuthn RP/name hardcoded to the current domains.
- **What's missing:** `preDeployCommand` (see §3B). Otherwise the blueprint is well-formed.

**What must be tucked away in the Render dashboard (not in the file):** all `sync: false` secrets — DB URLs, Redis, Chapa, AfroMessage, OAuth, Supabase service-role/anon, Groq, VAPID (public+private), `CRON_TOKEN`, `METERED_API_KEY`. The `.env.example` + `render.yaml` only document the *interface*; actual values live in the dashboard. (I deliberately did not and could not inspect your live secrets — you should confirm each `sync: false` var is actually populated in the dashboard.)

### Vercel (`vercel.json`)
```json
{
  "buildCommand": "shared build && web build",   // runs next build --webpack
  "installCommand": "npm install",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs"
}
```
- Runs **at the repo root** (no `rootDirectory`), builds both shared and web, outputs `apps/web/.next`. `apps/api` is excluded by `.vercelignore`.
- **Verified working** — homepage returns 200 in 0.2s, so the config deploys successfully end-to-end.
- **Env contract (must be set in Vercel dashboard):** `NEXT_PUBLIC_API_URL` (prod `https://apex-work-api.onrender.com`), `NEXT_PUBLIC_APP_URL` (`https://apex-work-gold.vercel.app`), `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_CHAPA_PUBLIC_KEY`. Note `NEXT_PUBLIC_*` vars are **baked in at build time**, so changing them requires a redeploy.
- **Gotcha:** because `apps/api` is ignored by `.vercelignore`, keep the workspace install clean — `npm install` must tolerate the missing `apps/api` workspace folder. It currently works (proven live), but a change to the lockfile could break it; worth confirming CI + Vercel both pass after any package.json change.

### The `.env` "contract" summary (what truly matters)
- **API needs 3 non-negotiable envs:** `DATABASE_URL`, `JWT_SECRET` (≥32 chars), and either `PORT` (PaaS) or `API_PORT`.
- Everything else degrades gracefully — the API will boot and serve without Chapa, OAuth, Supabase, Groq, VAPID, or Cron, just with those features disabled (this is why `/v1/ready` is green).
- Web only needs the `NEXT_PUBLIC_*` set at build time.

---

## 5. What you should do (prioritized)

**P0 — address now**
1. **Revoke the GitHub token** you shared (see §0).
2. **Fix the cold-start** — the 32 s first load is the biggest UX/architecture problem. Move API to an always-on instance (Render Starter ~$7 or Koyeb/Fly/Hetzner ~free-tier with no sleep), or make external warmup reliable and monitor it. Real users on Ethiopia mobile networks will abandon a 30 s spin-up.
3. **Add `preDeployCommand` to `render.yaml`** so `prisma migrate deploy` runs automatically on every deploy.

**P1 — correctness / onboarding**
4. Regenerate **`.env.example`** from `envSchema` (Supabase, not R2; plus VAPID, CRON_TOKEN, WEBAUTHN, METERED).
5. **Reconcile README + DEPLOY.md** with the real Render/Vercel/Supabase setup (currently describes Koyeb + R2).
6. Fix **CORS rejection** to return 403 instead of 500.

**P2 — quality / hardening**
7. Add real **e2e (Playwright)** + **coverage** scripts, or drop the README claims. Expand unit coverage beyond the 8 service tests.
8. Add a **fallback in-memory rate limiter** for OTP/PIN/refresh when Redis is down (don't fully disable auth throttling).
9. Decide & document the **payment payout (Chapa Transfers)** enabling path (currently off — good default, just confirm intentionally).
10. Verify in dashboards that every `sync:false` secret is actually populated (DB, Redis, Chapa, AfroMessage, OAuth, Supabase, Groq, VAPID, CRON_TOKEN, METERED).
11. Optional: wire **Sentry/PostHog** (envs already declared) for prod observability — it's the missing visibility for issues like the cold start.

---

## 6. Verdict

**This is a strong, unusually disciplined codebase** — especially around secrets hygiene, env validation, security defaults, and graceful degradation. The engineering behind the free-tier resilience is thoughtful.

The **problems are mostly at the deployment/documentation seam rather than in the code**: the cold-start behavior (measured), missing automated migrations, and three-way documentation/config drift (Render vs Koyeb, Supabase vs R2). Fix those and the project is in genuinely good shape to take real users.
