# 🚀 Deployment Guide

## Architecture

```
GitHub (main) ──┬─→ Vercel (web)   → https://apex-work-gold.vercel.app
                └─→ Render (api)   → https://apex-work-api.onrender.com
                        ↓
                    Neon (Postgres)
                    Upstash (Redis)
                    Supabase (Storage)
                    Chapa (payments)
                    AfroMessage (SMS)
```

Both deploy automatically when you push to `main`. All zero-cost until real usage.

---

## Step 1 — Provision free services (~5 min)

### 🗄️ Postgres — [Neon](https://neon.tech)
1. Sign in with GitHub
2. Create project **"apex-work"** in region **AWS eu-central-1** (Frankfurt)
3. Copy the **pooled** connection string → this is your `DATABASE_URL`
4. Copy the **direct** connection string → this is your `DATABASE_URL_UNPOOLED` (used for migrations)

### ⚡ Redis — [Upstash](https://upstash.com)
1. Sign in with GitHub
2. **Create Database** → name "apex-work", region "eu-central-1"
3. Copy the **Redis TLS URL** (`rediss://...`) → this is your `REDIS_URL`

### 🗃️ Storage — [Supabase](https://supabase.com)
1. Create a project and enable **Storage**
2. Copy the project **URL** → `SUPABASE_URL`
3. Copy the **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose)
4. Copy the **anon** key → `SUPABASE_ANON_KEY`
5. Create buckets: `portfolio`, `chat-attachments`, `avatars`

### 💳 Payments — [Chapa](https://chapa.co)
1. Sign up → Dashboard → **Settings → API Keys**
2. Copy `secret_key_test` (start with sandbox)
3. Later, verify business → get live keys

### 📱 SMS — [AfroMessage](https://afromessage.com)
1. Sign up → Dashboard → **API**
2. Copy your API key & identifier ID
3. (Buy credits when ready — ~0.30 ETB/SMS)

---

## Step 2 — Deploy Web to Vercel (~2 min)

1. Go to <https://vercel.com/new>
2. **Import Git Repository** → select `Davezeni/Apex-work`
3. **Framework Preset**: Next.js (auto-detected)
4. **Root Directory**: `.` (leave at repo root — the root `vercel.json` handles the monorepo)
5. Add the environment variables below, then **Deploy**

### Env vars to set on Vercel

These are **`NEXT_PUBLIC_*`** and are **baked into the bundle at build time** — changing them requires a redeploy.

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://apex-work-api.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | `https://apex-work-gold.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `Apex-Work` |
| `NEXT_PUBLIC_CHAPA_PUBLIC_KEY` | Your Chapa public key |

---

## Step 3 — Deploy API to Render (~5 min)

The repo ships a **`render.yaml` blueprint** — connect the repo in the Render dashboard and Render provisions the service automatically. It deploys a `web` service on the **free** plan in **frankfurt**.

- **Build:** `npm ci` → build `@apex-work/shared` → `prisma generate` → build the API
- **Pre-deploy:** runs `prisma migrate deploy` against the DB (direct/unpooled connection when available)
- **Start:** `node apps/api/dist/server.js`
- **Health check:** `GET /v1/health`

> ⚠️ **Free plan limitation:** Render free web services **sleep after ~15 min of idle** and cold-start (30–60 s) on the next request. Warm-up pings (GitHub Actions every 5 min + in-process self-ping) reduce but do not fully eliminate this. Move to an always-on instance before launch if the latency matters.

### Env vars to set on Render (secrets live in the dashboard — never commit)

| Key | Notes |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled URL |
| `DATABASE_URL_UNPOOLED` | Neon direct URL (used by migrations) |
| `REDIS_URL` | Upstash Redis TLS URL |
| `JWT_SECRET` | Generate: `openssl rand -base64 48` |
| `CORS_ORIGINS` | `https://apex-work-gold.vercel.app` |
| `WEB_URL` | `https://apex-work-gold.vercel.app` |
| `API_URL` | `https://apex-work-api.onrender.com` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | Storage |
| `CHAPA_SECRET_KEY` / `CHAPA_PUBLIC_KEY` / `CHAPA_WEBHOOK_SECRET` | Payments |
| `AFROMESSAGE_API_KEY` / `AFROMESSAGE_IDENTIFIER_ID` / `AFROMESSAGE_SENDER` | SMS |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth |
| `GROQ_API_KEY` | AI (optional) |
| `VAPID_PUBLIC` / `VAPID_PRIVATE` | Web push |
| `CRON_TOKEN` | Protects `/v1/cron/*` |
| `METERED_API_KEY` | WebRTC TURN relay (optional) |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_ORIGIN` | `apex-work-gold.vercel.app` / `https://apex-work-gold.vercel.app` |

### WebAuthn note
`WEBAUTHN_RP_ID` (no scheme/port) and `WEBAUTHN_RP_ORIGIN` (full https origin) **must** match the web app's origin. If you add a custom domain, update both (they are set in `render.yaml` and can be overridden in the dashboard).

---

## Step 4 — Initialize the database (first deploy only)

Render now runs `prisma migrate deploy` automatically on every deploy. For a fresh DB you only need to optionally seed:

```bash
cd apps/api
DATABASE_URL="<neon-direct-url>" npx tsx prisma/seed.ts
```

---

## Step 5 — Verify

1. Visit `https://apex-work-gold.vercel.app` — landing page loads
2. Visit `https://apex-work-api.onrender.com/v1/health` — returns `{ ok: true, ... }`
3. Visit `https://apex-work-api.onrender.com/v1/ready` — `db` and `redis` both `ok`
4. Open the web app on your phone → `/signup` → enter your phone
5. If you set up AfroMessage, you'll get a real SMS

---

## Auto-deploy on push

Both services auto-redeploy when you push to `main`:
- **Vercel** — detects push via GitHub App
- **Render** — detects push via GitHub integration (`autoDeploy: true`)

No manual redeploy needed. ✨

---

## Custom domain (optional)

- **Vercel:** project → Settings → Domains → add `apex-work.et`, add the CNAME Vercel gives you.
- **Render:** use the Dashboard to add a domain to the service, then update `API_URL` and the WebAuthn vars.

---

## Cost check

| Service | Free tier | When you'd pay |
|---------|-----------|----------------|
| Vercel | 100 GB bandwidth/mo | > 100 GB (unlikely early) |
| Render | 1 free web service (sleeps) | > 1 service or always-on |
| Neon | 3 GB storage, 1 project | > 3 GB |
| Upstash | 10K commands/day | > 10K/day |
| Supabase | 1 GB storage | > 1 GB |
| Chapa | 2.5% per transaction | Only when you earn |
| AfroMessage | Pay per SMS | Every SMS (~0.30 ETB) |

**MVP total: essentially free until you have real users.** 🎯
