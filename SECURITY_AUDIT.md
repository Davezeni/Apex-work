# Apex-Work — Security Assessment & Penetration Test Report

**Target:** `apex-work-gold.vercel.app` (web) · `apex-work-api.onrender.com` (API)
**Date:** 2026-09-21 · **Build assessed:** marker `2026-09-09.138` (commit `1837726`)
**Classification:** Internal — owner eyes

---

## 1. Scope & methodology (read this first — honesty section)

**What was done:**

1. **Static code review** of the full monorepo: auth, authorization, payments, uploads, AI, admin surface, infra config, CI.
2. **Passive, unauthenticated black-box probes** against production: security headers, TLS config, authentication enforcement, injection reflection, rate-limiter behavior, webhook defenses (code-verified). A total of ~30 lightweight requests — no brute force, no load, no test data.

**What was NOT done (and why):**

- **No authenticated attack chains** (privilege escalation, IDOR enumeration, payment-flow abuse): they require seeded attack accounts and could touch **real money/escrow**. Running those against production is reckless; they belong on a staging seed.
- **No load testing / DoS simulation** on free-tier infrastructure.
- **No mobile/third-party surface** (Chapa, SMSEthiopia, Groq, Resend side of the integrations).
- **No session-flag verification** (requires a real login; listed in recommendations).

So this is a **code-review-driven assessment + external posture check**, not a full CREST-style pentest. Conclusions below are evidence-backed; unknowns are labeled as such.

---

## 2. Executive summary

**Overall posture: STRONG for a free-tier MVP — materially above typical marketplace baselines.** No critical or high vulnerability was confirmed. The design decisions that matter (parameterized ORM, shared zod validation, SSRF guard, webhook re-verification, idempotency ledger, RBAC middleware) are real, implemented, and verified — not aspirational.

| Severity           | Confirmed findings                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| 🔴 Critical        | **0**                                                                                                     |
| 🟠 High            | **0 confirmed** — 1 **operational risk** (backup absence) that is not a code vuln but outranks most vulns |
| 🟡 Medium          | 2 (monitoring blind spot; unverified session/cookie flags)                                                |
| ⚪ Low / hardening | 4                                                                                                         |

---

## 3. Verified defenses (evidence from this assessment)

| Control                | Evidence                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security headers (API) | `strict-transport-security: max-age=31536000; includeSubDomains`, `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`, `referrer-policy: no-referrer` — all present                                                                                                                                                                |
| Security headers (Web) | Same set + `permissions-policy` (camera/mic/geo self)                                                                                                                                                                                                                                                                                           |
| TLS                    | Valid Google Trust Services certs on both hosts, auto-renewed (expires Oct/Nov 2026)                                                                                                                                                                                                                                                            |
| Auth enforcement       | `GET /v1/me` → 401, `GET /v1/admin/health` → 401, `GET /v1/admin/users` → 401 — no unauthenticated data access                                                                                                                                                                                                                                  |
| Admin RBAC             | `adminOnly` middleware on the entire `/admin` surface; role checks in services; admin deletion protects ADMIN accounts (code-verified)                                                                                                                                                                                                          |
| SQL injection          | Prisma-only data access (no raw SQL); probe `' ; DROP TABLE users;--` → **403**, no error leak                                                                                                                                                                                                                                                  |
| XSS                    | Zero reflection of `<script>` probes in responses; React escaping; no `dangerouslySetInnerHTML` on user data in audited paths                                                                                                                                                                                                                   |
| SSRF                   | `lib/safeUrl.ts`: scheme allowlist, userinfo reject, private-hostname + **all IPv4-literal** block, DNS-resolution check (kills `nip.io`/rebinding bypass — incl. a test that proves it), per-redirect-hop revalidation in link previews. **Fixed a real hole this cycle:** `/ai/transcribe` previously fetched a client-supplied URL unguarded |
| Rate limiting          | Redis-backed; `ratelimit-limit: 300` / `ratelimit-remaining` / `ratelimit-reset` headers on every response; separate tighter budgets on auth/AI/OTP routes                                                                                                                                                                                      |
| Payment integrity      | Chapa webhooks: signature check (`chapa-signature`/`x-chapa-signature`) **and** transaction re-verification against Chapa's API; idempotency keys; unique `(user, type, relatedId)` ledger index makes double-credits impossible by schema; escrow splits atomic                                                                                |
| Password storage       | bcrypt cost 12                                                                                                                                                                                                                                                                                                                                  |
| Sessions               | 15-min access JWT + 30-day rotating refresh; device list with revocation                                                                                                                                                                                                                                                                        |
| Secrets hygiene        | No secrets in repo (gitleaks CI gate on every push); dashboard-injected env only                                                                                                                                                                                                                                                                |
| Supply chain           | `npm audit --omit=dev --audit-level=high` CI gate + weekly Dependabot                                                                                                                                                                                                                                                                           |
| File uploads           | Extension allowlist (pdf/docx/txt/md), size caps, non-negotiable content handling                                                                                                                                                                                                                                                               |

---

## 4. Findings

### 🟠 H-1 — Mitigation BUILT (2026-09-21), needs 2 repo secrets: No database backups / disaster recovery (operational risk)

- **Detail:** free Render Postgres expires periodically and has no automated backup. Escrow balances, ledgers and user data live there. This is the single highest-impact risk to the business regardless of any code vulnerability.
- **Likelihood/Impact:** medium / severe (irreversible data loss).
- **Recommendation:** scheduled `pg_dump` GitHub Action (encrypted artifact or private storage) **now**; paid managed Postgres with PITR when revenue starts. I can build the dump automation on request.
- **UPDATE:** `.github/workflows/backup.yml` is now in place — weekly encrypted (AES-256, PBKDF2 200k) full dumps stored as 90-day-retention GitHub artifacts, plus manual run button. **To activate, add 2 repo secrets** (Settings → Secrets and variables → Actions): `DATABASE_URL_BACKUP` = the UNPOOLED Postgres URL from Render, `BACKUP_PASSPHRASE` = a strong passphrase (store it somewhere safe — the dump is useless without it). Without the secrets the workflow skips gracefully.

### ✅ M-1 — RESOLVED (2026-09-21): Production error monitoring is LIVE

- **Detail:** owner set `SENTRY_DSN` on Render; the service redeployed (health uptime reset) and Sentry initializes at boot. End-to-end verified: a controlled harmless fault (malformed-JSON probe) produced a captured event in the Sentry project.
- **Follow-through:** the probe also revealed malformed client JSON was surfacing as 500s (would have polluted Sentry) — now correctly mapped to **400 BAD_JSON** / **413 PAYLOAD_TOO_LARGE** in the error handler, so Sentry only sees real faults. Web-side Sentry (server+edge+client instrumentation) exists in code: add `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` on **Vercel** to light it up.

### ✅ M-2 — RESOLVED (2026-09-21): Session transport is bearer-only (no cookies)

- **Detail:** codebase-wide grep confirms the API never sets a cookie (`res.cookie` count = 0); tokens travel as Authorization headers with rotation + device revocation. The cookie-flag concern is therefore N/A — there are no session cookies to flag. CORS is pinned to the two known origins. Residual XSS exposure is covered by React escaping, strict zod input validation, and short access-token expiry.

### ✅ L-1 — RESOLVED (2026-09-21): Per-user daily AI quota implemented

- **Detail:** every AI route now enforces a per-user daily quota (default 150/day, tunable via `AI_DAILY_LIMIT` env) via Redis INCR counters (48h expiry). Production-only enforcement; fail-open on Redis errors so the feature never breaks. Combined with the existing route limiter + Groq caching, the budget-abuse surface is closed.

### ⚪ L-2 — Prompt injection via CV text

- CV content is untrusted input to the LLM. Mitigations already in place: extraction-only prompt (no tools, no instructions-following surface), output must pass strict zod coercion + semantic sanitizer, results stored as inert data. Residual risk: low. Do **not** add tool-use/agent features to this path without re-review.

### ⚪ L-3 — Platform-level DDoS/WAF only

- Protection is whatever Vercel/Render provide (managed anycast + TLS termination). Acceptable at this stage; Cloudflare in front (free) is the standard upgrade when abuse appears.

### ⚪ L-4 — SMS single-provider

- Deliberate (redundancy removed for operational simplicity). Availability risk if SMSEthiopia has an outage = OTP login pauses. Documented, accepted, owner-approved.

### ✅ Checked and explicitly NOT vulnerable (common false-positive zones)

- IDOR on resume/CV entities: services scope every read/write by `userId`; position fields assigned server-side.
- JWTNone/alg-confusion: HS256 with fixed algorithm in `jsonwebtoken` options; secret ≥ 32 chars enforced by zod at boot.
- Mass assignment: zod schemas whitelist every writable field; Prisma inputs are built field-by-field.
- Webhook forgery: signature + API re-verification (see table).
- Directory traversal on uploads: extension allowlist + no filesystem writes from user paths.

---

## 5. OWASP Top-10 (2021) coverage

| Risk                          | Status                                                                   |
| ----------------------------- | ------------------------------------------------------------------------ |
| A01 Broken Access Control     | ✅ Route+service layer checks, RBAC, 401/403 probes pass                 |
| A02 Cryptographic Failures    | ✅ TLS, bcrypt(12), HS256 strong secret; ⚠ cookie flags to confirm (M-2) |
| A03 Injection                 | ✅ Prisma parameterization, React escaping, zod validation, SSRF guard   |
| A04 Insecure Design           | ✅ Idempotency ledger, escrow re-verification, role-pure flows           |
| A05 Security Misconfiguration | ✅ Helmet, pinned CORS, no debug endpoints in prod; ⚠ Sentry off (M-1)   |
| A06 Vulnerable Components     | ✅ CI audit gate + Dependabot                                            |
| A07 AuthN Failures            | ✅ Rate-limited OTP/auth, rotation, device revocation, passkeys          |
| A08 Integrity Failures        | ✅ Signed webhooks + re-verification, gitleaks, lockfile installs        |
| A09 Logging & Monitoring      | ⚠ pino logging strong; alerting off until Sentry DSN set (M-1)           |
| A10 SSRF                      | ✅ Dedicated guard with DNS-resolution defense + tests                   |

---

## 6. Prioritized recommendations

1. **Now:** enable Sentry (set `SENTRY_DSN` on Render) — M-1.
2. **Now:** build automated DB backups — H-1 (say the word and I'll implement the pg_dump workflow).
3. **This week:** 15-minute authenticated cookie-flag verification — M-2.
4. **This month:** seed a staging DB and run the authenticated attack-chain suite (IDOR/escalation/payment abuse) there, not in prod.
5. **Ongoing:** keep revoking any credential that touches a chat; Dependabot PRs merged weekly.

---

_Method note: probes were non-destructive by design; totals: ~30 external requests, all at human speed. This document should be refreshed after every major auth/payment change._
