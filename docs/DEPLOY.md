# 🚀 Deployment Guide

## Architecture

```
GitHub (main) ──┬─→ Vercel (web)           → https://apex-work.vercel.app
                └─→ Koyeb (api)            → https://apex-work-api.koyeb.app
                        ↓
                    Neon (Postgres)
                    Upstash (Redis)
                    Chapa (payments)
                    AfroMessage (SMS)
```

All zero-cost until real usage.

---

## Step 1 — Provision free services (~5 min)

### 🗄️ Postgres — [Neon](https://neon.tech)
1. Sign in with GitHub
2. Create project **"apex-work"** in region **AWS eu-central-1** (Frankfurt)
3. Copy the **pooled connection string** → this is your `DATABASE_URL`
4. Copy the **direct connection string** → this is your `DATABASE_URL_UNPOOLED`

### ⚡ Redis — [Upstash](https://upstash.com)
1. Sign in with GitHub
2. **Create Database** → name "apex-work", region "eu-central-1"
3. Copy the **Redis TLS URL** (`rediss://...`) → this is your `REDIS_URL`

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

### Option A: Dashboard (recommended)
1. Go to <https://vercel.com/new>
2. **Import Git Repository** → select `Davezeni/Apex-work`
3. **Framework Preset**: Next.js (auto-detected)
4. **Root Directory**: `.` (leave as root — `vercel.json` handles it)
5. Add environment variables (see below)
6. Click **Deploy**

### Option B: CLI
```bash
npm i -g vercel
cd apex-work
vercel --prod
```

### Env vars to set on Vercel

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://apex-work-api.koyeb.app` (or your Koyeb URL) |
| `NEXT_PUBLIC_APP_URL` | `https://apex-work.vercel.app` (or your custom domain) |
| `NEXT_PUBLIC_APP_NAME` | `Apex-Work` |
| `NEXT_PUBLIC_CHAPA_PUBLIC_KEY` | Your Chapa public key |

---

## Step 3 — Deploy API to Koyeb (~5 min)

### Option A: Dashboard
1. Go to <https://app.koyeb.com>
2. **Create App** → **GitHub** → select `Davezeni/Apex-work`
3. **Branch**: `main`
4. **Build**:
   - Builder: **Buildpack** (auto)
   - Build command:
     ```
     npm install && npm --workspace @apex-work/api run db:generate && npm --workspace @apex-work/api run build
     ```
   - Run command: `node apps/api/dist/server.js`
5. **Ports**: 4000 (HTTP, public)
6. **Health check**: `GET /v1/health`
7. **Region**: Frankfurt (closest to Ethiopia)
8. **Instance**: **eco (free)** — always-on 512MB
9. Add env vars (see below), then **Deploy**

### Env vars to set on Koyeb

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `API_PORT` | `4000` |
| `DATABASE_URL` | Neon pooled URL |
| `DATABASE_URL_UNPOOLED` | Neon direct URL |
| `REDIS_URL` | Upstash Redis TLS URL |
| `JWT_SECRET` | Generate: `openssl rand -base64 48` |
| `CORS_ORIGINS` | `https://apex-work.vercel.app` (comma-separated) |
| `WEB_URL` | `https://apex-work.vercel.app` |
| `API_URL` | `https://your-app.koyeb.app` |
| `CHAPA_SECRET_KEY` | From Chapa dashboard |
| `AFROMESSAGE_API_KEY` | From AfroMessage |
| `AFROMESSAGE_IDENTIFIER_ID` | From AfroMessage |

---

## Step 4 — Initialize the database

After Koyeb deploys and the API is up, run migrations from your local machine
(pointing at the production DB):

```bash
cd apps/api
DATABASE_URL="<neon-pooled-url>" \
DATABASE_URL_UNPOOLED="<neon-direct-url>" \
  npx prisma migrate deploy

# Optional: seed demo data
DATABASE_URL="<neon-pooled-url>" \
DATABASE_URL_UNPOOLED="<neon-direct-url>" \
  npx tsx prisma/seed.ts
```

---

## Step 5 — Verify

1. Visit `https://apex-work.vercel.app` — landing page loads
2. Visit `https://your-api.koyeb.app/v1/health` — returns `{ ok: true, ... }`
3. Open the web app on your phone → try `/signup` → enter your phone
4. If you set up AfroMessage, you'll get a real SMS

---

## Auto-deploy on push

Both services auto-redeploy when you push to `main`:
- **Vercel** → detects push via GitHub App
- **Koyeb** → detects push via GitHub integration

No manual redeploy needed. ✨

---

## Custom domain (optional)

### Vercel
1. Vercel Dashboard → your project → **Settings → Domains**
2. Add `apex-work.et` (or whatever you own)
3. Update DNS: add the CNAME Vercel gives you

### Koyeb
Same flow, or use `api.apex-work.et` for the API subdomain.

---

## Cost check

| Service | Free tier | When you'd pay |
|---------|-----------|----------------|
| Vercel | 100 GB bandwidth/mo | > 100 GB (unlikely early) |
| Koyeb | 1 web service always-on | > 1 service |
| Neon | 3 GB storage, 1 project | > 3 GB |
| Upstash | 10K commands/day | > 10K/day |
| Chapa | 2.5% per transaction | Only when you earn |
| AfroMessage | Pay per SMS | Every SMS (~0.30 ETB) |

**MVP total: essentially free until you have real users.** 🎯
