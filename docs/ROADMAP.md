# Apex-Work — Product & Admin Roadmap (Senior Review)

**Author:** Senior / Staff eng + eng-manager perspective
**Date:** 2026-08-30
**Scope:** Full user app + admin panel gap analysis, with prioritized, implementation-ready suggestions.

---

## TL;DR

The **user app is feature-rich** (60+ routes covering the full marketplace loop) and well-engineered. The **admin panel is the bottleneck**: it can only observe-and-suspend. It cannot *operate* the marketplace, enforce content policy, manage money, run promotions, or tune the product — all of which real-marketplace ops require. The plan below closes that gap, then hardens the whole system. Roughly one quarter of the admin routes listed in §3 already exist server-side but **aren't surfaced in the UI** — wiring them is cheap; the rest need new backend + UI.

---

## 1. Current admin capability audit (what exists today)

**Admin tabs (frontend `apps/web/src/app/admin/page.tsx`):**
`summary` · `reports` · `disputes` · `withdrawals` · `users` · `certs` · `diagnostics`
...plus two standalone pages: `/admin/skills` and `/admin/templates`.

**Admin API surface (`routes/admin.routes.ts`):**
`/summary`, `/resume-templates`, `/reports(...)`, `/reports/:id/resolve`, `/withdrawals(...)`,
`/withdrawals/:id/status`, `/users`, `/users/:id/suspend`, `/skills`, `/skills/:id/moderate`,
`/certifications`, `/certifications/:id/verify`, `/diagnostics`, `/turn/refresh`, `/email/test`, `/disputes(...)`, `/disputes/:id/resolve`.

**What can admin DO today?** Read aggregates, triage reports, resolve disputes, update withdrawal status, search+search user, suspend/unsuspend user, moderate skills, verify certs, price/place resume templates, run diagnostics, send a test email.

**What admin CANNOT do today (the gaps):** moderate gigs/jobs, manage orders/milestones/refunds, moderate reviews/messages, oversee wallet/transactions, manage subscriptions/agencies/offers, run promotions/featured gigs, send broadcasts/announcements, manage support tickets end-to-end, edit system settings/fees/categories, see an audit trail, or manage **who else is an admin** (no RBAC — only role `ADMIN` exists).

---

## 2. Missing USER-app features (marketplace completeness)

These are the biggest functional holes on the user side. Each is a product gap, not a nicety.

| # | Feature | Why it matters | Notes |
|---|---------|----------------|-------|
| U1 | **Full-text search** (Postgres `pg_trgm` / `tsvector`) | `search.service.ts` currently uses `ILIKE %q%` — O(n), falls apart >a few hundred rows. | Add `pg_trgm` GIN index + ranked results. Docstring in `DB_STATUS.md` already flags this. |
| U2 | **Reviews actually wired to order flow** | `Review` model exists but the "client rates after COMPLETED" flow isn't guaranteed end-to-end. | Gate review on `Order.status === 'COMPLETED'`; one review per order; seller reply. |
| U3 | **Withdrawals → payouts** | `CHAPA_TRANSFERS_ENABLED` is off (correct). Payout path is unverified. | Verify Chapa Transfers bank-code mapping in sandbox, small payout, then ship. |
| U4 | **Order lifecycle enforcement / escrow** | Orders, milestones, disputes exist but need a deterministic state machine with timeouts. | Extract an `orderStateMachine` (DAG): `PENDING → ACTIVE → IN_REVIEW → DELIVERED → COMPLETED / DISPUTED`. Reject illegal transitions. |
| U5 | **Email + in-app notifications parity** | OTP/security email works; transactional emails (order updates, new messages, payouts) are thin. | Use the existing `EmailQueue` model; hook into state transitions (U4). |
| U6 | **Resume/portfolio polish** | Resume studio + PDF/DOCX already strong. Add **DOCX round-trip on import** for better parsing. | Optional; existing import is a good base. |
| U7 | **Referral lifecycle** | `/referrals` exists; ensure attribution + reward crediting is audit-safe and idempotent. | Add idempotency key on reward grant. |
| U8 | **Offline / PWA deeper** | PWA already exists. Add optimistic UI for messages + offline queue for chat. | Reduces churn on Ethiopian mobile networks. |
| U9 | **Accessibility (a11y)** | Radix-based, so mostly good. **Audit focus states, contrast** for Ethiopian-market low-end devices. | Run axe; fix violations. |
| U10 | **Money formatting / rounding** | ETB + fee math across orders; ensure a single `Money` util + integer-minor-units to avoid float drift. | Audit `amountEtb` arithmetic; use integer ETB or minor units. |

---

## 3. Admin panel expansion — the core ask

**Phase A — wire existing (low effort, high value).** These server capabilities exist but aren't in the UI:

- **Skills** & **Resume templates** are already separate pages — fold them into the single `/admin` shell as tabs (nav consistency).
- Surface the already-built `/diagnostics`, `/turn/refresh`, `/email/test` inside the UI (currently only in one raw tab).

**Phase B — new admin capabilities (the real work).** Grouped by domain. Suggested one new **module per tab**, each with `list(+paginate/filter)`, `detail`, and `action` endpoints.

### 3.1 Content & marketplace moderation (highest priority)
| Code | Admin surface to add |
|------|----------------------|
| M1 | **Gig moderation** — list (status/to-verify), feature/unfeature, toggle visibility, edit price/description, flag for review. |
| M2 | **Job moderation** — review job posts, close/flagg, pin, remove. |
| M3 | **Reviews moderation** — list lowest-rated/reported reviews, hide/restore, attach reason. (Reviews must be user-trustable.) |
| M4 | **Portfolio / resume review queue** — approve/hide profile content flagged as inappropriate. |
| M5 | **Message moderation** — read-only audit view for a specific conversation a user reported (respect privacy; only on a report). |

### 3.2 Money & orders (critical trust)
| Code | Surface |
|------|---------|
| F1 | **Orders / milestones board** — filter by status, search by order/user, force-resolve a stuck order; issue **refund** (amount-split), route to disputes. |
| F2 | **Wallet + transaction ledger** — full read-only audit of `Transaction`; manual credit/debit adjustment with `reason` + admin ID (audit-traced). |
| F3 | **Platform fee configuration** — editable `platformFeeRate` per gig category (settings, §3.5). |
| F4 | **Withdrawals deep-link** — already exists; add **bulk** status ops + financial summary. |

### 3.3 Community & trust
| Code | Surface |
|------|---------|
| C1 | **Block/suspend users** — exists (suspend). Add **role change** (promote/demote `ADMIN/MODERATOR/CLIENT/FREELANCER`), **avatar/phone lookup**, **notification override**. |
| C2 | **Verification queue** — `isIdVerified` flag currently has no admin action. Add approve/reject identity verification with evidence view. |
| C3 | **Agencies / teams** — list, approve, audit membership. |

### 3.4 Customer support
| Code | Surface |
|------|---------|
| S1 | **Support tickets** — `SupportTicket`/`SupportMessage` exist but admin has no view. Add queue: open/assigned/resolved, internal notes, reply, close. |

### 3.5 System & monetization
| Code | Surface |
|------|---------|
| Y1 | **Subscription / Pro** (`Subscription`, `ResumeTemplatePurchase`) — view active subs, grants, revenue. |
| Y2 | **Featured gigs / promotions** — admin-paid visibility; set `featuredUntil` + fee. |
| Y3 | **Broadcast/announcement** — push a global in-app banner + WebPush (`push.service.ts` already exists). |
| Y4 | **Settings hub** — platform fee, currency/categories, i18n fallback, max file size, feature flags (e.g. `features.requiresPhoneForX`). Would benefit from a `Setting` KV table (see §4). |
| Y5 | **Email queue** (`EmailQueue`) — monitor sends, retry failures, resend. |

### 3.6 Operations & safety (the part most platforms forget)
| Code | Surface |
|------|---------|
| O1 | **Audit log** — every admin mutation records `who / what / target / before→after / when`. Add an `AdminAuditLog` table + write in a shared `adminAudit()` helper. **Top recommendation.** |
| O2 | **Analytics** — beyond the count-summary: GMV/revenue trends (daily/weekly), conversion funnel (view→order→complete), top gigs, churn, D7 retention. Cache in Redis; render charts. |
| O3 | **RBAC** — single `ADMIN` role is too coarse. Add roles: `SUPERADMIN`, `MODERATOR`, `SUPPORT`, `FINANCE`, each with a capabilities map enforced in `adminOnly`/`requireAdmin`. |
| O4 | **Feature flags** — safe rollouts (e.g. enable Chapa transfers live, toggle a new feature) without redeploying. |
| O5 | **Pagination & search everywhere** — admin list endpoints currently `take: 50/100/200` with no offset/cursor. Add cursor pagination to all admin lists. |

---

## 4. Cross-cutting best practices & tech debt (senior-review scale)

### 4.1 Security hardening
- **Audit all admin mutations** (O1) — this is the single most important hardening step.
- **Rate-limit admin endpoints** separately (stricter than the global `apiLimiter`), keyed per-admin.
- **RBAC** (O3) so a normal operator can `.suspend` but only `FINANCE` can touch withdrawals and only `SUPERADMIN` can change roles.
- Confirm the app uses Bearer-only (no cookies) on the API → no CSRF surface; keep it that way.
- **Rotate any token/secret** that has ever been shared out-of-band (see the note in §5).

### 4.2 Data structures & algorithms
- **Order state machine** as a data structure (U4) — encode transitions in a const DAG map, not `if/else` chains. Reduces bugs and is testable.
- **Cursor pagination** utility (O5) — one reusable `parseCursor`/`encodeCursor` helper, base64 + opaque, to reuse across all list endpoints.
- **Caching:** add a small **Redis LRU** + local in-memory cache (with TTL + key prefix) for hot reads (public gig/job detail, categories). Current code mostly hits the DB directly.
- **Full-text search** (U1) — `tsvector` + GIN, ranked `ts_rank`, partial-match via `pg_trgm`; index at the DB, not in JS.

### 4.3 Code quality / structure
- **Service-repository split** for the money paths (orders, wallet, payments) — pure functions + injected store = easily unit tested.
- **Add a migration runner guard** — the new `preDeployCommand` is in place; add a CI check that runs `db:migrate:deploy` in a dry-run so drift is caught in CI, not prod.
- **Tests:** coverage is thin (8 files / 39 tests for a 51-model, 38-route backend). Prioritize: auth, orders/payments state machine, wallet, admin permission matrix, OAuth. Add the advertised **e2e (Playwright)** + **coverage** scripts you removed from the README.

### 4.4 Observability
- **Sentry/PostHog** ready in env but not wired. Add `Sentry.init` (API) + `@sentry/nextjs` (web) so the cold-start and any deploy regression is visible instantly.
- **Structured metrics** — track GMV/day, signups/day, D7 retention, order-completion rate, payout-success rate in Redis and surface in admin (O2).

---

## 5. Progress tracker

**✅ Done (shipped):**
- Admin control surface (RBAC + audit + moderation + money + support + ops) —
  see Changelog & `adminOps.routes.ts`.
- Order state machine as a DAG (`shared/domain/orderState.ts`).
- Money helper (`shared/domain/money.ts`).
- Full-text search (pg_trgm + similarity) — already shipped in
  `20260822180000_perf_search_indexes`; service uses trigram ranking.
- Cursor pagination, audit log, settings store, RBAC.
- Real test tooling: `test:coverage` + `test:e2e` (Playwright) + CI job.
- Secrets scan (gitleaks) + Dependabot dependency automation.
- Test coverage on the new admin surface (settings, audit, pagination, RBAC,
  money, community) — 103 unit tests.
- E2E suite validated against the live deploy: 7/7 Playwright tests pass
  (admin access-guards + public API smoke).
- **Admin time-series analytics** (feature #1 of the "power push"): per-day
  GMV / revenue / signups / orders-created / orders-completed charts on the
  Summary tab (`GET /admin/ops/analytics/series`, `lib/series.ts`, 117 tests).
- **Admin CSV exports** (#2) + **privacy/data export** (#4, GDPR-style
  `GET /me/data-export` + Settings → Security UI). 128 unit tests.
- Gig/profile analytics (#3) and recommendations/discovery (#5) already existed
  on the app side (`/me/profile-analytics`, gig analytics page, `GET
  /recommendations`).
- **Proactive moderation auto-flag scan** (#6): `lib/moderationRules.ts` rules
  engine + `POST /admin/ops/moderation/scan` + "Run auto-flag scan" button.
  137 unit tests.
- **Wallet reconciliation report** (#7): `lib/reconcile.ts` +
  `GET /admin/ops/reconcile` + "Reconcile" sub-view on Orders & Money.
  142 unit tests.
- **Referral programme analytics** (#8): `lib/referralStats.ts` +
  `GET /me/referrals` + live stats/list on the Referrals page. 146 unit tests.
- **Pro-monetization analytics** (#9): `lib/subscriptionAnalytics.ts` +
  `GET /admin/ops/subscriptions/analytics` + List/Revenue toggle on
  Subscriptions tab. 150 unit tests.
- **Support SLA & team dashboard** (#10): `lib/supportAnalytics.ts` +
  `GET /admin/ops/support/analytics` + Queue/SLA toggle with SLA cards and
  per-admin throughput. 155 unit tests.
- **Top-performer leaderboard** (#11): `lib/leaderboard.ts` +
  `GET /admin/ops/leaderboard` + Top performers/risers on Summary. 159 unit tests.
- **Admin content CMS: site announcement** (#12): typed `content.siteAnnouncement`
  AppSetting key + `GET /v1/content/announcement` + Settings editor +
  `AnnouncementBanner` site-wide. 163 unit tests.
- **Flag-queue moderation triage** (#13): `lib/moderationQueue.ts` +
  ModerationStatus enum + 4 Gig columns (DB migration) +
  `GET /admin/ops/flagged` + `POST /flagged/:id/triage` + `POST /flagged/bulk` +
  Flagged sub-view with status filter / select-all / per-item + bulk resolve.
  168 unit tests.

**⏳ Deferred (needs external accounts/keys to be useful):**
- **Sentry / PostHog wiring.** Both have free tiers but need org keys/DSN. The
  env vars are declared; wiring the SDKs without keys is a no-op, so it's left
  until the project has accounts. Add `@sentry/nextjs` + a `sentry.ts` init keyed
  off `SENTRY_DSN`, and PostHog's `posthog-js` keyed off `POSTHOG_KEY`.

**🕓 Stretch (free but large):**
- Aggressive coverage growth on the new admin services.
- Live custom-domain plumbing (DNS + WebAuthn RP update).

## 6. Immediate action list (this sprint)

1. **🔒 Revoke the GitHub token** you pasted in chat (both the original and the replacement). Treat as compromised.
2. Wire the **audit log** (`AdminAuditLog`) + `adminAudit()` helper (O1) — do this before expanding any admin endpoint.
3. Add **RBAC roles + capabilities map** (O3).
4. Implement **moderation endpoints** for gigs/jobs/reviews (M1–M3) + **support tickets** (S1) — highest business value.
5. Convert the 3 standalone admin pages into tabs, add cursor pagination (O5).
6. Add the **order state machine** (U4) and **hooks** for refunds/analytics.
7. Wire **Sentry** (API + web) for prod visibility.

---

## 6. Suggested admin IA (final tab map)

```
Admin shell
├── Summary          (exists — add trends/charts)      → O2
├── Moderation       (NEW: gigs, jobs, reviews, portfolio, messages-on-report) → M1–M5
├── Reports          (exists)                          → O5 pagination
├── Disputes         (exists)                          → O5
├── Orders & Money   (NEW: orders, refunds, wallet ledger, fee config) → F1–F4
├── Withdrawals      (exists)                          → bulk ops
├── Users            (expand: roles, ID verification, blocks) → C1–C2 + O3
├── Support          (NEW: tickets)                    → S1
├── Content          (move skills+certs+templates here)→ M-queue
├── Promotions       (NEW: featured, broadcast)        → Y2–Y3
├── Subscriptions    (NEW)                             → Y1
├── Settings         (NEW: fees, categories, flags, email queue) → Y4–Y5
├── Audit Log        (NEW)                             → O1
├── Diagnostics      (exists)
└── Admins           (NEW: RBAC / invite / perms)      → O3
```
