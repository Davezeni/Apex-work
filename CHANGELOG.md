# Changelog

All notable changes to Apex-Work will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — Telegram composer redesign + gestures (power push #36)

### Changed
- **Composer redesigned to the Telegram style** — a single rounded pill with
  the **emoji button inside on the left**, the text field in the middle, and
  the **paperclip (attach) inside on the right**, plus a **blue round send/+
  button** outside on the right (shows send when there's text, `+` when empty).
- **Tools open as a slide-up bottom sheet** — tapping the blue `+` slides up a
  sheet (voice message, stickers, save replies, timer, schedule, offer) with a
  grabber and backdrop, instead of an inline popover.
- **Long-press → reply** — press-and-hold any message bubble to start a reply
  (tap still opens the actions sheet; navigating long-press from buttons is
  ignored).
- **No horizontal movement** — the chat page and body are set to
  `overflow-x: hidden` so the page can't be dragged side-to-side.

### Fixed
- **Space above the input** — extra padding around the composer and message
  list so the last message never crowds the input bar.

## [Unreleased] — Composer spacing, attach button & zoom (power push #35)

### Added
- **Space above the input** — the composer has more top padding and the
  message list more bottom padding so the input never touches the last message.
- **Always-visible Attach** — the paperclip moved out of the `+` panel back
  onto the composer, so attaching is one tap.
- **"Send on Enter" toggle** — a switch in the header `...` menu (persisted
  per device). When on, Enter sends; when off, Enter makes a new line
  (Shift+Enter always makes a new line).
- **No pinch-zoom on the chat** — `/messages*` routes now ship a scoped
  `<meta viewport>` (`maximum-scale=1, user-scalable=no`) so the chat
  "playground" feels like a native messenger (other pages keep zoom).

## [Unreleased] — Telegram-style composer (power push #34)

### Changed
- **Decluttered composer** — the many side icons (sticker, timer, schedule,
  quick replies, offer) no longer squeeze the text input. The input is now a
  wide Telegram-style pill (textarea + inline emoji + a single `+` button),
  with a large send/mic button on the right.
- **`+` tools panel** — the `+` opens a labeled panel with Stickers,
  Save replies (quick replies), Disappearing timer, Schedule send, Offer
  (freelancers), and Attach. The active self-destruct timer shows a small
  badge beside the input.

## [Unreleased] — Voice waveforms + AI smart replies (power push #33)

### Added
- **Voice-message waveforms** — the recorder now samples a live amplitude
  waveform (WebAudio AnalyserNode), stores it in `attachmentMeta.waveform`,
  and audio bubbles render a custom waveform player (play/pause, live
  progress, duration) instead of a native bar. Falls back to the native
  player when no waveform is present.
- **Quick-react row in the action sheet** — the message actions sheet now
  shows one-tap reaction emojis (❤️ 👍 👎 😂 😮 🎉) at the top for fast reactions.
- **AI smart replies** — after a peer's message, up to 3 suggested short
  replies appear above the composer (one-tap to send); regenerate
  automatically on new dialogue, dismissible. Powered by `POST /v1/ai/replies`
  (Groq via `callGroq`, with a deterministic, language-aware Amharic/English
  fallback). New `suggestReplies` service + pure, testable `smart-replies`
  helpers (4 unit tests).

## [Unreleased] — Messenger power bundle (power push #32)

### Added
- **Sticker/GIF picker** — a free, curated emoji sticker picker (Smileys,
  Emotions, Hands, Animals, Food, Objects) with search, in the composer; a
  single-emoji message renders as a large sticker bubble.
- **Quoted-reply jump** — tapping a quoted reply block scrolls to and
  highlights the original message in the thread.
- **Seen-by avatars** — my own messages show a small avatar stack (up to 3
  + more) of exactly who has read them, with name tooltips.
- **Self-destruct (disappearing) messages** — per-message timer before sending
  (1m / 1h / 1d / 1w) with a live countdown and an "expired" chip when the
  time lapses (both sides filter it client-side).
- **Scheduled "send later"** — pick a send time (in 10 min / 1h / 3h /
  tomorrow) from the composer; the message is held locally and sent when the
  time arrives (while the app is open & online), with a cancelable
  "scheduled" panel.
- **Conversation pin / archive / smart grouping** — inbox rows can be pinned
  and archived (per-user, stored on-device), and the list is grouped into
  Pinned / Unread / Recent with a collapsible Archived section. No schema
  migration needed.

## [Unreleased] — Rich link previews (power push #31)

### Added
- **Link preview cards** — when a message contains a URL, the chat now
  unfurls it and renders a rich card (title, domain, description, cover image)
  instead of a bare link, like WhatsApp/Telegram/iMessage.
- **Live composer preview** — while typing a URL the card preview appears
  above the composer before you send.
- **`GET /conversations/unfurl`** — new authenticated endpoint that fetches a
  page and parses OpenGraph / Twitter-card metadata server-side (with SSRF
  guards against private/loopback hosts, response-size + 6s timeouts, and a
  15-min cache). Pure `link-preview` module + 11 unit tests.

### Fixed
- **SSRF safety** — the unfurl endpoint refuses private hosts, non-http(s)
  schemes, and unparseable URLs.

## [Unreleased] — Chat polish + full Amharic (power push #30)

### Fixed
- **Overlapping message icons** — the per-bubble side `⋯` triggers (which
  overlapped) are removed. Tapping a message bubble now opens a clean, labeled
  action sheet (Reply / React / Forward / Pin / Save / Copy / Edit / Delete).
- **Image viewer close button** — close/download controls are now layered above
  the image (they were being covered by the image layer) so they actually work;
  added prev/next gallery navigation, tap-to-zoom, and an "n of m" counter.
- **File attachments** — replaced bare text links with proper file cards
  (icon + name + size + download).

### Added
- **Comprehensive Amharic** — all new chat strings routed through `t()`; locale
  parity now **585 keys, 0 missing** (only proper-noun identicals remain).

## [Unreleased] — Messaging depth (power push #29)

### Added
- **Load older messages** — cursor pagination in the thread with a "Load older
  messages" button (prepends prior pages; `GET /conversations/:id/messages?cursor=`).
- **Read-receipts breakdown** — per-message `readBy`, `readByTotal`,
  `readByUserIds`; the message action sheet shows who has read it.
- **Group invite links** — `GET /conversations/:id/invite` issues a stable
  `inviteToken` (`Conversation.inviteToken`); `POST /conversations/join`
  adds the caller to the group; new `/messages/join/[token]` page.
- **Quick replies (saved phrases)** — composer ⚡ picker; save the current
  draft as a reusable reply, insert it with one tap.

## [Unreleased] — Messenger power-up + Saved Messages (power push #28)

### Added
- **Online presence** — live online/offline dots on the conversation list, chat
  header and group member sheet (Socket.io heartbeat + `presence` service).
- **Mute / unmute** a conversation; **mark as unread** (badge returns).
- **Forward any message** to another chat (mini forward picker).
- **In-conversation message search** (`GET /conversations/:id/messages/search`).
- **Pin / unpin messages** (`Message.pinnedAt` + live pin banner). 
- **Saved Messages** — a private 1-member self-chat: bookmark any message,
  voice note or file. New `GET /conversations/saved`; "Save" button on any
  message; pinned entry in the messages list.

### Polish
- Live typing + presence socket events merged into the client; admin build
  marker bumped to `2026-09-05.22`.

## [Unreleased] — Trust, messaging & product polish (power push #27)

### Fixed
- **Create/List team → "invalid database query"** — Prisma `include` was fed a
  mixed scalar+relation object (`memberSelect`) causing a
  `PrismaClientValidationError`. Both memberships now use `select`.
- **File uploads broken** — Supabase storage buckets were never created and the
  signed-upload response field was mis-read. New `ensureStorageBuckets()`
  auto-creates `avatars`, `portfolio` and `chat-attachments` (with per-bucket
  size limits) at API boot; idempotent (exists → 409 treated as OK); the sign
  reader now accepts `signedURL`/`url`; a missing bucket is self-healed on
  400/404. **Plus a self-hosted Postgres object-store fallback** (`Upload`
  table + `GET /v1/uploads/files/:id`) so uploads keep working when Supabase
  is unavailable — verified live via Supabase (primary) and locally (fallback).

### Added
- **Admins: add staff** — Admins can now search any user and assign a staff
  role (ADMIN/MODERATOR/SUPPORT/FINANCE) directly from the admin console.
- **Chat upgrade (Telegram-grade)** — group rooms (+ create/add/remove/rename/
  leave + member list + admins), reaction toggle, edit &amp; soft-delete of own
  messages, per-message read receipts (✓/✓✓ + counts), live typing indicators,
  realtime reaction/edit/delete/group-update broadcasts.
- **Investor proposal deck** — `docs/deck/investor-deck.html` with live product
  screenshots, user flows, security, performance, tech &amp; financial sections.

### Polish
- Vertical head/bottom room on mobile shell + bottom-nav clearance; typing-dot
  animation; admin build marker bumped to `2026-09-05.20`.

## [Unreleased] — Per-category fees + KPI threshold watcher (power push #26)

### Added
- **Per-category fee editor** — new `Category` table (seeded with the 8
  catalog categories; `id` = slug) carrying an optional `feePercent` override.
  Order creation (gig purchase + job proposal acceptance) now looks up the
  gig/job's category and uses its override, falling back to the global
  `platform.feePercent`. Admin Settings → Categories lets admins set/edit/
  reset the fee per category (blank = inherit global). Migration
  `20260904130000_categories_and_kpi_watcher`.
- **KPI threshold watcher + alerting** — new `KpiThreshold` (configurable
  key/operator/value/window/severity) + `KpiAlert` (fired alerts with
  acknowledge/resolve). `checkKpiThresholds()` runs in the cron `/tick` and
  `/cron/kpi` job, computing signups/GMV/revenue/orders/disputes/withdrawals
  over a window and firing a deduped alert on breach, auto-resolving when the
  metric recovers. Admin Settings → KPI shows live values, editable
  thresholds, and an alert inbox with acknowledge.

## [Unreleased] — CSAT, referral tracking, offline indicator, admin palette (power push #25)

### Added
- **CSAT post-ticket** — `SupportTicket` gains `csatRating` / `csatComment` /
  `csatScoredAt` (migration `20260904120000_csat_and_referral_clicks`); API
  `POST /support/:id/csat` (owner-only, once per resolved/closed ticket);
  web shows a one-time star prompt on resolved tickets; admin support table
  surfaces the CSAT score + comment.
- **Referral tracked links + share card** — new `ReferralClick` append-only
  log + `POST /referrals/track` (public). Signup page now passes the `?ref=`
  code to `/auth/signup` so attribution actually persists, and tracks a click
  when someone lands via a share link. Referrals page gets a share-card
  preview + a live "Link clicks" stat.
- **PWA offline indicator** — the chat page now shows an amber banner when the
  browser is offline (and counts queued messages waiting in the IndexedDB
  outbox). The outbox flusher already existed; this surfaces its state.
- **Admin command palette** — `⌘K` / `Ctrl+K` (and a search button) opens a
  fuzzy search over the visible admin sections with arrow-key navigation,
  Enter to run, Esc to close.

## [Unreleased] — Review replies (seller rebuttal) (power push #24)

### Added
- **DB** — `Review.sellerReply` / `sellerRepliedAt` / `sellerReplyEditedAt`;
  new `NotificationType.REVIEW_REPLY`; migration `20260904110000_review_reply`
  (applied via Render `preDeploy` `db:migrate:deploy`).
- **API** — `PUT /reviews/:id/reply` (only the subject/seller of a review can
  post or edit their response; idempotent; notifies the reviewer on first
  reply) and `DELETE /reviews/:id/reply` (remove). `listReviewsFor` now returns
  `subjectId` + the reply fields. `REVIEW_REPLY` maps to the `reviews`
  notification preference.
- **Web** — the reviews page shows the seller's response under each review and
  gives the signed-in seller `Reply` / `Edit` / `Remove` controls (inline
  editor, 2000 chars); `useUpsertReviewReply` + `useDeleteReviewReply` hooks;
  en + am strings; notifications icon; marker `.15`.

## [Unreleased] — PostHog consent banner + high-signal events (power push #23)

### Added
- **Analytics consent** — `lib/analytics.ts` got `hasConsent()` / `setConsent()`
  (backed by `apx-consent` in localStorage); PostHog init opts out when the
  user declined; a `ConsentBanner` shows once on first visit when PostHog is
  configured.
- **High-signal events** — `track('signup', { role, oauth })` on signup and
  `track('order_request', { gigId, packageTier, checkoutUrl })` when an order
  is created, plus the existing `order_action` and `identify_user`.

## [Unreleased] — Sentry + PostHog observability wiring (power push #22)

### Added
- **Sentry (API / Node)** — `config/sentry.ts` (`initSentry`, `captureException`,
  `captureMessage`), no-op without `SENTRY_DSN`; `captureException` wired into
  the global error handler; Diagnostics reports `sentry: configured`.
- **Sentry (web / Next.js)** — `@sentry/nextjs` with the modern App Router
  setup: `src/instrumentation.ts` (server/edge `register()` + `onRequestError`),
  `src/instrumentation-client.ts` (`onLoad` + `onRouterTransitionStart`),
  `app/global-error.tsx` (React render errors), and `withSentryConfig` in
  `next.config`. Sourcemap *source-generation* disabled so the free-tier build
  stays under memory limits (Vercel still produces `.map` files for traces).
- **PostHog (web)** — `lib/analytics.ts` (`initPosthog`, `track`, `identify`),
  a `PostHogInit` provider in the Providers tree, `identifyUser` on `/me`,
  and a `track('order_action', { action, status })` on order lifecycle events.
- **Env** — `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_POSTHOG_KEY`
  documented in `.env.example`; real values live only in gitignored `.env`
  files (never committed).

> NOTE: to capture in production, add the env vars to Render (API) and Vercel
> (web) — see README/OBSERVABILITY notes. Without them the SDKs no-op safely.

## [Unreleased] — Marketplace health score, fraud watchlist, escrow timeline, gig SEO (power push #21)
## [Unreleased] — Marketplace health score, fraud watchlist, escrow timeline, gig SEO (power push #21)

### Added
- **Marketplace health score** — `lib/healthScore.ts` (pure `buildHealthScore`: a
  weighted 0–100 composite of activation, churn, disputes, delivery SLA,
  support SLA, liquidity and quality, each as a 0–100 contributor) +
  `GET /admin/ops/health-score` + Summary tab health card with per-component
  bars and a grade.
- **Fraud/abuse watchlist** — `lib/fraudWatch.ts` (pure
  `scoreWatchlistUser`/`rankWatchlist`: transparent velocity rules — young
  account + high volume, high dispute rate, cancellation churn, early
  withdrawals, review velocity — scoring to high/medium/low/clear) +
  `GET /admin/ops/fraud-watchlist` + Summary tab watchlist.
- **Escrow timeline** on the order page (client pays → held → released,
  disputed note) — reassures both parties where the funds are.
- **Gig SEO structured data** — JSON-LD `Product` + `Offer` (price, availability,
  brand, aggregate rating) injected on the gig detail page for search/social.
- **+9 unit tests** — 195 → 204 tests.

## [Unreleased] — Retention & churn analytics + email-queue monitor + Agencies tab (power push #19)

### Added
- **Retention & churn analytics** — `lib/retention.ts` (pure `buildRetention`:
  activation, D7/D14/D30 activation rate, churn, weekly activation cohorts) +
  `services/admin/retention.service.ts` (DB groupBy on signups + first/last
  order per role) + `GET /admin/ops/retention` (`dashboard:view`).
  Summary tab: Retention section (activation/churn/D7–D30 cards + weekly bars).
- **Email-queue monitor** — `services/admin/emailQueue.service.ts` (queued /
  sent / failed buckets, delivery rate, top failures, recent rows) +
  `GET /admin/ops/email-queue` + `POST /admin/ops/email-queue/flush`
  (`settings:manage`, audited). Settings tab "email" sub-view with a flush
  action.
- **Agencies admin tab** — `adminGetAgency` (detail + members) +
  `adminUpdateAgencyMember` + `GET /agencies/:id` +
  `POST /agencies/:id/members/:userId` (`moderation:content`, audited) +
  Agencies tab with expandable member view and role updates.
- **+4 unit tests** — 191 → 195 tests.

## [Unreleased] — Pro-subscription ROI analytics (power push #16)

### Added
- **Pro-subscription ROI** — `lib/proRoi.ts` (pure `buildProRoi`: cohort ROI
  multiple, net value, avg per-subscriber ROI, repurchase rate, profitable %,
  best/lowest ROI) — measures whether a Pro pass pays for itself.
- **`GET /admin/ops/subscriptions/roi`** (`subscriptions:manage`) — aggregates
  subscription cost per user + completed-order value generated (freelancer
  earnings / client spend) via DB groupBy.
- **ROI view** on the Subscriptions tab: ROI/net/subscribers cells, invested vs
  returned, avg ROI + repeat rate, and best/lowest-ROI subscriber lists.
- **+4 unit tests** — 187 → 191 tests.

## [Unreleased] — Downloadable receipts & monthly earnings statement (power push #15)

### Added
- **`lib/statement.ts`** — pure `buildOrderReceipt` + `buildMonthlyStatement`:
  self-contained printable HTML (inline styles, HTML-escaped, no external
  resources), with totals and a per-order table.
- **`services/earnings.service.ts`** — `receiptForOrder` (party role-check) and
  `monthlyStatement` (completed orders in a calendar month).
- **Routes** `GET /orders/:id/receipt` (+ `.json`), `GET /me/earnings/statement`
  (+ `.json`) — served as downloadable attachments.
- **Order page** — new server "HTML" receipt download (in addition to the
  existing PDF receipt); **Stats page** — Monthly earnings statement card with a
  month picker (download + show totals).
- **`lib/api`** — `downloadViaAuth` authenticated blob-download helper.
- **+5 unit tests** — 182 → 187 tests.

## [Unreleased] — Order-health needs-attention inbox + daily digest (power push #15)
### Added
- **`lib/orderHealth.ts`** — pure `buildOrderHealth`/`classifyOrder`: flags
  overdue delivery, stale dispute, stale review, unresolved delivery and
  abandoned orders with severity + age; priority inbox, per-category counts and
  a ready-to-send digest.
- **`services/admin/orderHealth.service.ts`** — order query by status + durable
  EmailQueue digest to staff + audit trail.
- **Routes** `GET /admin/ops/order-health`, `POST /admin/ops/order-health/digest`
  (`dashboard:view`).
- **Money tab** "health" sub-view: summary chips, per-category counts, priority
  inbox, "Send daily digest".
- **+9 unit tests** — 173 → 182 tests.

## [Unreleased] — Freelancer win-rate & per-gig conversion insights (power push #14)

### Added
- **Conversion insights** — `lib/conversionInsights.ts` (pure
  `buildConversionInsights`: view→order conversion + order-completion "win"
  rate per freelancer and per gig, a funnel, and best-converting /
  highest-earning gig rankings; conservative when there are no views/orders).
- **`GET /admin/ops/insights/conversion`** (`dashboard:view`) — aggregates at
  the DB via groupBy (candidate gigs ordered by volume, capped at 500) and
  never loads whole tables.
- **Conversion insights · 30d** on the Summary tab: funnel (views → orders →
  completed), top converters by win-rate with an inline rate bar,
  best-converting and highest-earning gigs.
- **+5 unit tests** — 168 → 173 tests.

## [Unreleased] — Flag-queue moderation triage (power push #13)

### Added
- **Moderation triage for flagged gigs** — `lib/moderationQueue.ts` (pure
  `buildQueueSummary`: bucket counts via `[groupBy, _count]` + open items
  oldest-first; `canBulkResolve` narrows the target to `RESOLVED | DISMISSED`)
  with a small DB migration adding `ModerationStatus` (QUEUED/IN_REVIEW/
  RESOLVED/DISMISSED) and four Gig columns (`moderationStatus`,
  `moderationAssignee`, `moderatorNotes`, `moderatedAt`).
- **`GET /v1/admin/ops/flagged`** — paginated list filtered by status
  (`QUEUED|IN_REVIEW|RESOLVED|DISMISSED`), RBAC `moderation:content`.
- **`POST /v1/admin/ops/flagged/:id/triage`** — set status / assignee / notes on
  a flagged gig.
- **`POST /v1/admin/ops/flagged/bulk`** — bulk resolve or dismiss up to 200
  flagged gigs at once.
- **Flagged sub-view** on the Moderation tab: status filter chips, select-all,
  per-item Start-review / Resolve / Dismiss / Assign, and bulk resolve/dismiss.
- **Migration** `20260904100000_gig_moderation_triage` (hand-written, one enum
  value per `ALTER TYPE` for Postgres 11 safety) + `prisma generate` on 5.22.0.
- **+5 unit tests** — 163 → 168 tests.

## [Unreleased] — Admin content CMS: site-wide announcement (power push #12)

### Added
- **Admin-managed site announcement banner** stored as a typed value in the
  existing `AppSetting` store (`content.siteAnnouncement`) — no DB migration.
  `lib/announcement.ts` sanitises/normalises `{text, tone, href, cta}` (clamps
  lengths, rejects unsafe `javascript:` hrefs) and is unit-tested.
- **Public `GET /v1/content/announcement`** (no auth) returns the current
  announcement (`{announcement: ... | null}`).
- **Settings tab**: a dedicated editor for the announcement (text, tone
  Info/Promo/Urgent, optional CTA + link).
- **`AnnouncementBanner`** mounted in the root layout → dismissible site-wide
  bar with an optional CTA/link, loading via the public endpoint.
- **+4 unit tests** — 159 → 163 tests.

## [Unreleased] — Top-performer leaderboard (power push #11)

### Added
- **Top-performer leaderboard** — `lib/leaderboard.ts` (pure
  `buildLeaderboard`: independently ranks freelancers and clients by revenue,
  plus a trailing-window "risers" list) + `GET /admin/ops/leaderboard` (RBAC
  `dashboard:view`). Aggregates at the DB via groupBy/sum, never loads whole
  tables.
- **Top performers · 30d** section on the Summary tab: freelance & client
  leaderboards (rank, revenue, rating, orders) with profile links, plus a
  "Rising" card for window activity.
- **+4 unit tests** — 155 → 159 tests.

## [Unreleased] — Support SLA & team dashboard (power push #10)

### Added
- **Support SLA analytics** — `lib/supportAnalytics.ts` (pure
  `buildSupportAnalytics`: open/aging queue, unattended + SLA-breached counts,
  oldest-open age, resolved-in-7d, avg first-response time, per-admin
  throughput ranked) + `GET /admin/ops/support/analytics` (RBAC
  `support:tickets`).
- **Queue / SLA toggle** on the Support tab: SLA stat cards (open, unattended,
  breached, resolved, avg first reply, oldest-open banner) and a per-admin
  handled + first-response table. SLA window = 24h to first response.
- **+5 unit tests** — 150 → 155 tests.

## [Unreleased] — Pro-monetization analytics (power push #9)

### Added
- **Pro revenue analytics** — `lib/subscriptionAnalytics.ts` (pure
  `buildSubscriptionStats`: active subscribers, active/total revenue, trailing
  window revenue + purchases, avg price, by-plan revenue/share ranked, top
  plan) + `GET /admin/ops/subscriptions/analytics` (RBAC `subscriptions:manage`).
- **List / Revenue toggle** on the Subscriptions tab: revenue cards (Pro subs,
  active value, avg price, window revenue + purchases) and a by-plan revenue
  bar chart (hand-rolled, no chart lib).
- **+4 unit tests** — 146 → 150 tests.

## [Unreleased] — Referral programme analytics (power push #8)

### Added
- **Referral dashboard** — `lib/referralStats.ts` (pure `buildReferralStats`
  mapping referred users → total/active/pending cohorts, attributed GMV and
  commission at a configurable reward rate, top referral) +
  `GET /me/referrals` returns shareable `ref` link/code, stats and the referred
  list with completed-order aggregates.
- **Referrals page** now shows real numbers (Referred / Active / Earned) and a
  live "Your referrals" list instead of hard-coded zeros.
- **+4 unit tests** — 142 → 146 tests.

## [Unreleased] — Wallet reconciliation report (power push #7)

### Added
- **Wallet reconciliation report** — `lib/reconcile.ts` (pure: build
  reconciliation over wallet balances + ledger sums, computes signed drift,
  surface worst offenders first) + `GET /admin/ops/reconcile` (RBAC
  `money:orders`) that aggregates at the DB via a LEFT JOIN + GROUP BY (never
  loads whole tables).
- **"Reconcile" sub-view** on the Orders & Money tab: wallets/in-sync/drifted
  counters, net-drift warning banner, and a drift list sorted by magnitude.
- **+5 unit tests** — 137 → 142 tests.

## [Unreleased] — Proactive moderation auto-flag scan (power push #6)

### Added
- **Moderation rules engine** (`apps/api/src/lib/moderationRules.ts`): pure,
  testable `analyzeContent` / `maxSeverity` / `summarizeFlags` against a
  declarative rule-set (off-platform + scam, prohibited items, off-platform
  contact, PII/doxxing, adult, spam) — case/whitespace-insensitive substring
  matching. Conservative by design to limit false positives.
- **`POST /admin/ops/moderation/scan`** (RBAC `moderation:content`, audited):
  scans recent gigs (auto-sets `isFlagged`/`flaggedReason`), jobs and reviews,
  returning a scanned/flagged summary + the flagged items (gigs, jobs, reviews).
- **"Run auto-flag scan" button** on the Moderation tab (SectionHead action);
  invalidates the gigs/reports queries on success.
- **+9 unit tests** — 128 → 137 tests.

## [Unreleased] — Power push #2–#4: CSV exports, privacy/data export

### Added
- **Admin CSV exports** — `GET /admin/ops/export/{audit|orders|users}` (RBAC per
  kind + download headers). "Export CSV" buttons on the Audit, Orders & Money
  and Users tabs; fetches with the Bearer token and downloads from a blob (token
  never appears in a URL). Pure `lib/csv.ts` (RFC-4180) is unit-tested.
- **One-click data export (GDPR-style)** — `GET /me/data-export` streams a JSON
  bundle of everything a user owns (profile, gigs + base package price, jobs,
  client/seller orders with counterpart, reviews given/received, counts). New
  "Data & privacy" section in Settings → Security with an Export button and a
  link to account deletion.
- **+11 unit tests** (CSV serialisation + export payload builder) — 117 → 128
  tests.

## [Unreleased] — Admin time-series analytics (feature #1 of the power push)

### Added
- **Time-series analytics on the admin Summary tab**: daily GMV, revenue,
  signups, orders created and orders completed, rendered as interactive SVG
  line charts with 7/30/90-day window switch and hover tooltips. No chart
  library — hand-rolled SVG stays free/OSS and tiny.
- **`GET /admin/ops/analytics/series`** API (RBAC `dashboard:view`) that
  aggregates per-day buckets at the database (`date_trunc` + raw SQL) so we
  never load full tables into Node, then folds them into a gap-free series.
- **Pure series lib `apps/api/src/lib/series.ts`** — `buildDailySeries`,
  `startDateForDays`, `deltaOfSeries`, `maxSeriesValue` (unit-tested without a
  DB).
- **+14 unit tests** (series bucketing + analytics helpers) — 103 → 117 tests.
- Build marker bumped to `2026-09-01.1` (visible in the admin header).
- Fixed a latent `withdrawals.service.ts` implicit-`any` that would have
  failed a strict production typecheck.

## [Unreleased] — Deploy fix: admin panel now live on Vercel

### Fixed
- **Root cause of the missing admin tabs on the live panel:** Vercel's team
  setting requires the git **commit author** to be a member of the Vercel team
  to create deployments. All feature commits were authored as
  `Apex-Work Dev <dev@apex-work.local>` (not a team member), so Vercel blocked
  every deployment (`BLOCKED`, `readyStateReason = "Git author ... must have
  access to the team"`), leaving the site on the old build.
- Fixed by committing as the team identity (`Davezeni <tamirud8@gmail.com>`)
  and deploying. Added a visible **`ADMIN_UI_BUILD` marker** (currently
  `2026-08-30.3`) in the admin header (`Staff · 2026-08-30.3`) so any future
  deploy is verifiable from the panel.
- **Verified live:** `/admin` returns 200; the live admin chunk
  (`page-17877eff7d4adedd.js`) contains the new tabs (`Admin team`, `Audit log`,
  `Orders & Money`, `Subscriptions`, etc.). API `/v1/health` + `/v1/ready` (db,
  redis) all 200.
- **Open item for the account owner:** the GitHub↔Vercel project integration
  is currently **disconnected** (`git`/`link` null), so pushes to `main` do not
  auto-deploy. Reconnect it (`vercel git connect` or Settings → Git in the
  dashboard) so future pushes deploy automatically.

## [Unreleased] — Money/community coverage + e2e verification (free OSS)

### Added
- **+15 unit tests** for the money service (refund: credit wallet + ledger +
  cancel; over-refund/debt/overflow guards; wallet adjust credit/debit,
  overdraw and missing-wallet; ledger filter combining) and community service
  (role change, ID verify, suspend/restore, user list AND-filter, detail) —
  88 → 103 tests.
- E2E verified: **all 7 Playwright tests pass against the live deploy**,
  including admin access-guards (unauthenticated `/admin` → login redirect,
  login renders, `/admin/ops/*` → 401) and public API smoke (health, readiness,
  search reachable).

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

## [Fix] — PostHog init crashed the whole app (analytics namespace bug)

### Fixed
- `lib/analytics.ts` `getPosthog()` resolved `require('posthog-js')` directly,
  but posthog-js is an ESM package whose real singleton lives under `.default`
  when imported via CommonJS. The result was `.init` being `undefined`, so
  `ph.init(...)` threw `TypeError: e.init is not a function` on every route
  render, surfacing the global error boundary ("Something went wrong") on the
  sign-in/sign-up pages. Now normalises to the `.default` export when it
  exposes `.init`, and `initPosthog()` is fully try/catch-guarded so analytics
  can never take the app down. Marker `.18`.

## [Fix] — Announcement banner + earnings statement pointed at the web origin

### Fixed
- `AnnouncementBanner` and the earnings-statement download used a relative
  `fetch('/v1/...')` URL, which resolved to the Vercel origin and 404'd (the
  API lives on Render). They now use the exported `API_BASE` so the admin-set
  announcement banner and statement download actually load. (Pre-existing; did
  not affect sign-in/sign-up.)
