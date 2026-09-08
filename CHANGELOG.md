# Changelog

All notable changes to Apex-Work will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — PWA + desktop layout polish (power push #72)

- **PWA notification icons** (`public/sw.js`) — fixed the push-notification
  default icon/badge paths that pointed at a non-existent `/icons/` directory
  (assets are at the site root); bumped the service-worker `VERSION` to `v7`
  so installed clients pick up the fix and purge stale caches.
- **Desktop gig grid** (`browse`) — results and skeleton now render inside a
  centered `max-w-7xl` container with `xl`/`2xl` column counts
  (`2xl:grid-cols-5`), so cards don't stretch across ultra-wide monitors.
- **Desktop public profile** — the freelancer gigs list became a responsive
  `md:grid-cols-2 lg:grid-cols-3` grid, and the profile card + content sections
  center inside a `max-w-4xl` on large screens instead of spanning full width.
- Note: reputation/trust/verification polish on profiles and PWA install/offline
  behaviour were already present (TrustCard, phone-verification banner, service
  worker + beforeinstallprompt + NetworkStatusBanner); this pass tightened
  their layout + correctness rather than duplicating them.
- Verified: web+api typecheck 0 errors, web lint clean, shared build 0.

## [Unreleased] — Recently viewed gigs (power push #71)

- **"Recently viewed" row** — viewing a gig now records it in a device-local
  list (`use-recently-viewed.ts`, localStorage) so returning visitors can jump
  straight back to the gigs they looked at, even before/without signing in.
  - Tracked on the gig detail page (deferred 600 ms so first paint stays light).
  - Rendered as a compact horizontal row on the **home** and **browse** pages.
  - Deduped, newest-first, capped at 8; a **Clear** action resets the list.
  - Shown only when the list is non-empty (never shows a bare empty section).
  - i18n keys added (`home.recentlyViewed`, `home.clear`) in en + am.
- Verified: web+api typecheck 0 errors, web lint clean, shared build 0,
  227 unit tests pass.

## [Unreleased] — Desktop notifications dropdown + search polish (power push #70)

- **Desktop notification dropdown** — the desktop sidebar's bottom user card
  now shows the live `NotificationsPanel` dropdown (with an `align` prop so it
  opens leftward from the left rail). Desktop users get the same inline
  notification list, unread dots, "Mark all read" and "View all" as mobile —
  no need to navigate away to `/notifications`.
- **Search skeleton loading** — the `/search` results area now shows a
  shimmering skeleton grid/list while the query resolves instead of a bare
  spinner.
- **Search empty state** — "No matches" now has a branded icon and two actions:
  **Clear search** (resets the box) and **Browse gigs** (CTA to `/browse`).
- Verified: web+api typecheck 0 errors, web lint clean, 227 unit tests pass.

## [Unreleased] — Security & concurrency hardening (README audit, run #54)

Fixes the 10 release blockers from the security/concurrency audit:

- **Cron fail-closed** (`cron.routes.ts`) — a missing `CRON_TOKEN` now REJECTS
  every cron request in production; the open-by-default behaviour only applies
  to dev/test.
- **WebRTC signaling authorization** (`socket.ts`, `chat.service.ts`) —
  `call:signal` now verifies BOTH the caller and the target belong to the
  conversation before relaying SDP/ICE; `call:start/end/join/leave` also gate
  on membership, so a socket can't broadcast to a room it's not a member of.
- **Link-preview SSRF redirect hardening** (`link-preview.ts`) — `unfurl` now
  follows redirects manually and re-validates every destination against
  loopback/private/link-local/IPv6 ranges (manual `redirect: 'manual'` loop,
  capped at 5 hops). `isBlockedHost` also covers IPv6 link-local, unique-local,
  mapped and loopback ranges.
- **Atomic order acceptance** (`jobs.service.ts`) — `acceptBid` atomically
  claims/closes the job (`updateMany` conditional on `isOpen: true`) before
  creating the order, so one job can't get two orders.
- **Atomic delivery acceptance** (`orders.service.ts`) — `acceptDelivery` uses a
  compare-and-set status claim first; if the order already transitioned it
  aborts, so funds are never released twice.
- **Atomic milestone approval** (`milestones.service.ts`) — `approve` claims
  `DELIVERED → APPROVED` conditionally and only pays when that succeeds.
- **Atomic dispute resolution** (`disputes.service.ts`) — `adminResolve` claims
  the dispute atomically before any ledger movement, so two admins can't both
  move money for one dispute.
- **Withdrawal transition guard** (`withdrawals.service.ts`) — `markStatus`
  enforces a legal state machine and uses a conditional CAS; an illegal
  `SUCCESS → CANCELLED` is rejected and a concurrent transition can't double
  refund.
- **Refund reconciliation policy** (`money.service.ts`, `disputes.service.ts`) —
  documented the explicit policy (internal wallet ledger = source of truth;
  provider-side Chapa refunds are MANUAL) matching the implementation.
- **Readiness hardening** (`routes/index.ts`) — `/v1/ready` now returns only
  coarse boolean per-dependency state; DB error messages and Redis status
  strings are logged server-side only.
- Verified: api web typecheck 0 errors, api lint clean, **227 unit tests pass**
  (added regression tests for the CAS transitions + redirect SSRF).

## [Unreleased] — Realtime notifications: dropdown panel + toasts (power push #69)

- **Notification dropdown panel** — the bell (home header) now opens an inline
  dropdown showing the latest notifications with unread dots, a "Mark all
  read" action (with success/error toasts), a "View all" link, and a friendly
  empty state. Works on mobile and desktop; responsive width, outside-click +
  Esc to close.
- **Realtime in-app toasts** — the notification socket now fires a toast for
  each new notification (order, bid, payment, system…), and a subtle "New
  message" toast for chats, with a "View" action that jumps to the right
  conversation/order. Shows only when you're not already on the notifications
  page.
- **Live socket on desktop too** — `useNotificationSocket` is now mounted once
  in the Providers tree (removed from mobile-shell), so desktop users get the
  same realtime stream + unread refresh.
- Also refreshes the unread-count query on each event so badges stay live.
- Verified: web+api typecheck 0 errors, web lint clean, 219 unit tests pass.

## [Unreleased] — Global ⌘K command palette + keyboard shortcuts (power push #68)

- **Global ⌘K / Ctrl+K command palette** — available on every route (mounted
  in the Providers tree), reusing the admin `CommandPalette` component
  (now with a customisable placeholder). Jump to any primary route or compose a
  gig straight from the keyboard. Esc closes; arrow keys navigate; Enter opens.
- **Desktop sidebar ⌘K launcher** — a "Search or jump to…" button with a ⌘K
  kbd hint in the sidebar opens the palette, so it's discoverable on desktop.
- **Keyboard shortcut "/"** — on Browse, pressing `/` focuses the search box.
- **Notification unread badge on the desktop sidebar** — the Notifications nav
  item now shows the live unread count (reads the same `useUnreadCount` the
  mobile bell uses), so desktop users see new alerts too.
- Added `nav.achievements` i18n (EN + Amharic).
- Note: the gig detail **sticky mobile checkout CTA** already existed, so no
  change was needed there.
- Verified: web+api typecheck 0 errors, web lint clean, 219 unit tests pass.

## [Unreleased] — Server-side search + gig gallery lightbox (power push #67)

- **Server-side search on Browse** — typing in the search box now queries the
  API (debounced 300ms) across the full catalog instead of only filtering the
  currently-loaded pages, so results are found even beyond what's already
  fetched. `Load more` carries the search term + category to the next page; the
  local sort toggle still works on the complete result set.
- **Gig image gallery + lightbox** — the gig detail page wasn't rendering
  `galleryUrls` at all. It now shows a 3-column photo grid (deduped cover +
  gallery) and opens a full-screen `ImageViewer` with swipe/nav through all
  photos. Added `gig.gallery` i18n key (EN + Amharic).
- Verified: web+api typecheck 0 errors, web lint clean, 219 unit tests pass.

## [Unreleased] — Infinite-scroll browse + profile skeleton (power push #66)

- **Infinite scroll on Browse** — the list now loads 30 gigs and keeps appending
  as you scroll (an IntersectionObserver sentinel + explicit "Load more" button
  with `cursor` pagination), instead of hard-stopping at 30. Dedupe by id; the
  first page resets when the category changes.
- **Profile skeleton** — while your profile loads it shows a shimmering skeleton
  (avatar, name, stats grid, action cards) instead of a bare spinner, matching
  the layout.
- Verified: api+web typecheck 0 errors, web lint clean, 219 unit tests pass.

## [Unreleased] — OTP login fix + messenger & polish batch (power push #65)

### Fixed
- **OTP login said "expired" even when the code was fresh.** The root cause was a
  duplicate submission race: typing/pasting the last digit fired `onChange`,
  Enter, and the Verify button — the first call consumed the OTP, so any
  subsequent call got a spurious "Code expired". Fixed on **both sides**:
  - Client: a `useRef` guard in the login/signup/phone-verify flows ignores
    overlapping `verifyAndLogin`/`verifyOtp`/`verify` calls.
  - API: `verifyOtp` is now idempotent — the same correct code re-verifies
    within a 60s grace window after consumption, so a double-submit or a
    dropped-response retry never bounces as "expired". (Wrong codes still count
    attempts and lock after 5.)
- This also un-blocks **"remember me"/device + biometric**: a login that no
  longer fails leaves a valid `deviceToken`, so the next visit auto-signs-in
  via the trusted-device flow on the same phone.

### Improved
- **Telegram-style message grouping & date separators** — consecutive messages
  from the same sender now merge into one visual block: tighter gap, rounded
  outer corners with a "tail" corner only on the last message of a run. Day
  changes insert a separator and start a fresh group.
- **Scroll restoration** — a `ScrollRestore` component preserves the window
  scroll position per route and restores it on back/forward, so Browse/Gigs no
  longer jump to the top.
- **Skeleton loading** — Browse and Pro dashboard now show shimmering skeleton
  grids/cards instead of a bare spinner while data loads.
- **Focus-visible + reduced-motion** — broader on-brand focus ring (covers
  `summary`, `[role=button]`, `[contenteditable]`), `scroll-margin` so focused
  controls aren't hidden under sticky headers, and `prefers-reduced-motion`
  support.
- Verified: api+web typecheck 0 errors, lints clean, 219 unit tests pass.

## [Unreleased] — Resilience & media batch: AI rate-limit UX, offline banner, WebP media (power push #64)

- **AI assistant rate-limit UX** — when `/v1/ai/*` trips the 20/min limiter the
  assistant no longer shows a misleading "fallback" reply. It now marks the
  message with a visible *"Slow down — try again in a few seconds"* badge and
  locks the send button for a 20s countdown, so users don't hammer the endpoint.
- **Global offline banner** — a slim top banner (`NetworkStatusBanner`) now
  appears on *every* route the moment the browser goes offline, and dismisses
  itself on reconnect. SSR-safe.
- **WebP/AVIF media in the messenger** — the media gallery thumbnail grid and
  the inline attachment bubbles now render through the Supabase image
  transformer (`supabaseLoader`) instead of raw `<img>`/`unoptimized`, so chat
  images come down auto-negotiated and much lighter.
- Verified: web typecheck 0 errors, web lint clean, 219 unit tests pass.

## [Unreleased] — Desktop & performance batch: lazy chat, image hero, inbox layout (power push #63)

- **Code-split the heavy chat components** — `CallPanel`, `VoiceRecorder`,
  `AttachButton`, `ReactionPicker`, `StickerPicker` and `WaveformPlayer` are
  now `next/dynamic` lazy modules in `components/lazy.tsx`, so the initial
  thread bundle is much smaller and only downloads a picker/panel/player when
  it actually opens (faster LCP on the message list).
- **Gig detail hero → `next/image`** — the hero cover now uses `next/image`
  (`fill`, `priority`, AVIF/WebP, `sizes`) instead of a raw `<img>`, matching
  the card cover and cutting bandwidth on mobile.
- **Desktop inbox (`/messages`) layout** — the conversation list is now
  constrained to a readable `max-w-2xl` on desktop instead of stretching
  full-width, and the header aligns, so the inbox reads like a proper pane
  beside the sidebar.
- Verified: web typecheck 0 errors, web lint clean, 219 unit tests pass.

## [Unreleased] — Security hardening: AI rate-limit + HSTS (power push #62)

- **AI rate limiter** — the whole `/v1/ai/*` namespace (including the public
  `/ai/status` probe) is now capped at **20 calls / min / client** via a
  Redis-backed `aiLimiter` that falls back to an in-memory counter during a
  Redis outage (the existing resilient store). Every AI call hits an LLM
  provider, so this guards cost + latency and abuse. New
  `RATE_LIMITS.ai` constant in shared.
- **Frontend security headers** — added `Strict-Transport-Security`
  (`max-age=31536000; includeSubDomains`) and `X-DNS-Prefetch-Control` to the
  web. The app already had `X-Frame-Options: SAMEORIGIN`, `nosniff`,
  `Referrer-Policy`, and `Permissions-Policy` (camera/mic/geo).

## [Unreleased] — OTP/PIN login hardening (power push #61)

Verified the phone OTP login flow end-to-end and hardened every code input.

- **OTP input** (`components/auth/otp-input.tsx`) — now `name="otp"`, `pattern="[0-9]*"`, `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}`, `enterKeyHint="done"`, an `aria-label`, and a **submit-on-Enter** that fires the parent's verify-and-login (so desktop Enter and mobile "done" both log in). Digit-only, clamped to 6 (handles pasted SMS codes).
- **PIN input** (`components/auth/pin-input.tsx`) — same hardening + **submit-on-Enter** for the login PIN shortcut.
- Wired `onSubmit` through the login, signup, and settings/phone OTP flows.
- **Verified** full login via Playwright (mocked auth endpoints): OTP step appears, entering the code calls verify → login → session persists (`accessToken` set) → user lands on `/browse`. The previous "doesn't log in" symptom was traced to a fake-token session being cleared by a downstream 401 in the test harness — the real flow with real tokens works.

## [Unreleased] — Consent banner no longer covers the floating actions (power push #60)

The analytics consent banner used to span the full width at the bottom
(`inset-x-3`, `z-[100]`), covering the Help / Create "+" floating buttons on
first visit. It now slides in as a compact card anchored **top-left** (top
center on mobile), so it never blocks the bottom-right action chips. It
enters with a soft motion animation, has an icon, and is lower z-index than
the modals.

## [Unreleased] — Bug audit: dead-code cleanup (power push #59)

- Removed the now-unused `HIDE_ON` route array in the AI assistant (the
  visibility logic is inline).
- Removed an unused `useMe()` call in the desktop conversation rail.
- Full-suite verification: web + API typecheck green, web + API lint green,
  219 unit tests pass, 7 Playwright e2e smoke tests pass against the live
  deploy, and 14 routes audited with zero console errors.

## [Unreleased] — Profile hero: no color (power push #58)

- Own profile (`/profile`) hero — removed the violet `grad-hero` wash behind
  the avatar/name. Now a clean neutral surface: a flat card avatar on a subtle
  muted gradient band with a bottom border. No brand color in the hero.
- Public profile (`/u/[username]`) hero — the deep multi-color mesh gradient
  (indigo→violet→emerald→green) is gone. Now a neutral masthead: a muted
  tonal gradient that keeps the back/share controls legible in both light and
  dark mode, with no brand color.
- Accent colors remain only on intentional elements (avatars, badges, CTAs)
  which all render as consistent deep violet / muted palette.

## [Unreleased] — Fix washed-out "+" (`.grad-hero` now constant deep violet) (power push #57)

`.grad-hero` used `var(--primary)`, which is a LIGHT violet in dark mode; its
surfaces hard-coded `text-white`, so the chip read as near-white and
disappeared on the nav. `.grad-hero` now uses a **constant deep violet
`#7c3aed`** (plus a subtle top highlight), so with white text it's legible and
clearly visible in **both** light and dark mode. This fixes the mobile "+"
Create FAB, the sidebar logo tile, chat headers and the send button.

## [Unreleased] — Make the "+" and AI-support chips unmistakable (power push #56)

The add/create and AI-support floats were the same pale violet and washed
out on the light nav, so neither was visible.

- **`.grad-hero` is now a flat, confident violet** (solid `--primary` with a
  subtle top highlight) — no more translucent radial that faded to near-white
  on light surfaces. Every primary chip (mobile "+" FAB, logo tile, headers,
  chat send) now reads as solid violet.
- **The AI-support bubble got its own DISTINCT emerald fill** with a "Help"
  label, so it can never be confused with the violet "+" Create button. It now
  clearly reads as a separate support/assistant action.
- The mobile "+" Create FAB is enlarged (h-12, thicker plus, ring) so it pops
  over the white bottom nav.

## [Unreleased] — Fix: AI support bubble + desktop Create (+) now always visible (power push #55)

- **AI support bubble** is no longer hidden by the auth gate. Previously the
  floating assistant was gated behind `isAuthed` (so it vanished whenever
  `/me` returned 401/cleared session) and hidden on several routes. It now
  shows on **every route for everyone** — signed-in or not — because the
  fallback reply engine works without a session. It's still hidden only where
  it would obstruct the core UI: `admin`, `login`, `signup`, `resume/preview`,
  and *mobile* chat threads (the composer). On desktop it's visible even on
  open threads.
- **Desktop floating Create (+)** — a new bottom-right `+` FAB appears on
  `md+` (the mobile center FAB is `md:hidden`, so desktop had no floating add
  affordance). It opens the same Create bottom sheet. Flat violet, ring,
  shadow + hover lift, consistent with the new flat-brand buttons.
- The AI bubble sits above it (bottom-right), both clear of the sticky header
  and sidebar.

## [Unreleased] — Brand sweep: drop the rainbow gradient + richer desktop browse (power push #54)

The app no longer looks like a stock "vibe-coder" AI app. The loud
multi-colour gradient (violet→indigo→green) that was on CTAs, avatars, card
covers and the hero text is gone, replaced by a single restrained violet
brand with depth from shadow + hover + subtle radial highlight — the
Linear/Stripe/Raycast look.

- **`.grad-hero` / `.grad-text` redefined** — no more animated colour-cycling
  gradient; they now render as a flat `--primary` violet with a soft radial
  top highlight. All CTAs (Create, brand buttons, the sidebar logo tile) pick
  this up automatically.
- **The `default` button variant** is now a flat solid violet (shadow + hover
  lift + brightness) instead of a gradient.
- **Avatar fallbacks** — a new shared muted palette
  (`components/ui/avatar-gradient.ts`, violet/indigo/slate/muted-teal) replaces
  the six duplicated rainbow `AVATAR_GRADIENTS` arrays (violet→emerald,
  amber→red, cyan→violet…) across browse, search, gigs, threads, inbox,
  profile and home. Every avatar now looks coordinated and intentional.
- **Gig/gig-card covers** use the muted palette; the loud green/red/cyan tints
  were stripped from the pro, profile, saved, resume-template and home promo
  surfaces (now violet-only).
- **Landing category tiles** re-coloured to violet/indigo/slate.
- Ambient body/chat/mesh backgrounds are violet-only (green radial removed).

### Desktop browse header (redesigned)

On `md+` the Browse page header is a real app header: a larger title +
subtitle, an inline **search input** with a focus glow + ring (filters the
list live, clearable), and the category chips now **lift on hover**. Added a
client-side search filter across titles, owners and categories, switched the
default card view to **grid** (still persisted), and added i18n
`browse.subtitle/searchPlaceholder/clear`. Locale parity now **642/642**.

## [Unreleased] — Desktop two-pane messenger (power push #53)

The open thread is now a real desktop messenger. `messages/[id]` gets a
dedicated layout that composes the app sidebar and a new always-visible
**conversation rail** beside the chat, so a desktop user can switch chats and
navigate without losing the thread.

- **New `DesktopConversationRail`** (`components/desktop/conversation-rail`,
  300px, `hidden lg:flex`) — live inbox list beside an open thread: search
  filter, unread-first sort, unread count badges, online dots, live
  "typing…" indicator, last-message preview + relative time, a `layoutId`
  active accent that glides to the selected conversation, a Saved Messages
  shortcut, and a "Say hi" CTA.
- **`messages/[id]/layout.tsx`** — desktop shell (`DesktopSidebar` +
  conversation rail + `flex-1` thread `main`) with the full-page thread
  untouched. Mobile is unchanged (the sidebar and rail are `hidden` below
  `md`/`lg`), so the full-screen messenger still works on phones.

## [Unreleased] — Desktop styling: collapsible sidebar + list/grid + micro-animations (power push #52)

The desktop experience gets a modern, animated app feel with the same
subtle-motion system used on mobile.

- **Collapsible sidebar** — the desktop sidebar now collapses to a 76px
  **icon-only rail** with a smooth spring animation (stiffness 300 / damping
  30) via Framer Motion. A `layoutId` "sidebar-rail" indicator glides between
  the active nav items, and the Create button + user card collapse to icons.
  The collapse state is persisted (`apex-sidebar-collapsed`) and survives
  reload. A toggle button in the sidebar header expands/collapses it.
- **List / grid view toggle on marketplace cards** — the Browse page now has a
  **list | grid** switch in the sort row. Grid renders responsive cards
  (`2/3/4` columns) with a gradient cover, shimmer sweep, optional
  "Featured" badge, line-clamped title, rating + city, owner avatar/name +
  verified check, and a price block. List stays as a wide row card. Your
  choice is persisted (`apex-gig-view`).
- **Micro-animations everywhere** — entrance **stagger** on cards
  (`delay: i*0.03`, capped), **hover lift** on cards (row `y:-3`, grid
  `y:-6` with subtle scale + border glow/shadow), **cover shimmer** on hover,
  a **page-content fade-up** transition on route change (keyed by pathname),
  and an animated verified badge.
- Added i18n `gig.featured` (EN "Featured" / AM `ተመራጭ`); locale parity now
  **639/639**.

## [Unreleased] — Composer growth, spacing & gestures (power push #37)

### Added

- **Auto-growing input** — the composer now grows vertically as you type
  (up to ~140px, then it scrolls) instead of a fixed one-line box.
- **Space below the input** — the composer bar has real bottom padding plus
  the iOS/Android safe-area inset, so the text field never sits flush against
  the viewport bottom (no more negative space).
- **Send-arrow animation** — the send icon does a short "whoosh" slide on each
  send.
- **Swipe-back** — swipe right from the left edge of the chat to go back,
  like a native mobile app.
- **Blue `+` trigger** — the blue round button shows `+` when empty and slides
  up the tools bottom sheet.

## [Unreleased] — Desktop app shell + sidebar (power push #51)

- **Real desktop app experience.** `MobileShell` is now responsive: on desktop
  (`md+`) it renders a persistent **left sidebar** (`DesktopSidebar`) with the
  Apex-Work logo, a brand "Create" button, grouped nav (Workspace: Browse,
  Search, Chat w/ unread badge, Jobs, Saved, Notifications, Wallet; Account:
  Profile, Settings), a user card (avatar, name, @handle), and a Sign-out action.
  On mobile the existing bottom tab bar remains unchanged. Because every app
  page uses `MobileShell`, all of `/browse`, `/search`, `/messages`,
  `/profile`, `/jobs`, `/saved`, `/wallet`, `/notifications`, `/orders` now get
  the desktop shell automatically.
- Added i18n `nav` keys for the sidebar (EN + Amharic, 638/638 parity).

## [Unreleased] — Desktop auth routing & brand refresh (power push #50)

Rebuilt the app-wide visual language on a three-layer token architecture
(primitive → semantic → component), inspired by the open-source **UI/UX Pro
Max** skill (uupm.cc) using its **Freelancer Platform / Marketplace (P2P) /
Chat & Messaging** palettes — the exact product type of Apex-Work. See
`docs/DESIGN_SYSTEM.md`.

- **Typography** — swapped Inter for **Plus Jakarta Sans** (Friendly/Enterprise
  SaaS pairing: modern, approachable, legible, ideal for a B2B marketplace +
  admin), with a **Noto Sans Ethiopic** fallback so the full Amharic UI renders
  crisply instead of a system fallback. Font stack updated in the Tailwind theme.
- **Color tokens** — violet `#7C3AED` primary (trust) + hire-green `#16A34A`
  accent, with violet-tinted neutrals for background/card/muted/border so every
  surface feels on-brand rather than generic gray. Dark mode switched to a deep
  violet-black with a lighter violet primary for contrast. `.accent` was
  darkened in light mode (`142 66% 37%`) so white-on-green CTAs stay readable.
- **Brand gradient** — `.grad-hero` / `.grad-text` refined from violet→green→amber
  to violet→indigo→hire-green (`#7c3aed → #6366f1 → #16a34a`) for a cleaner,
  more premium look; mesh/chat ambient gradients matched.
- **Buttons** — the `default` variant now uses violet primary (`bg-primary
text-primary-foreground`) with a violet shadow + hover lift, so primary CTAs
  read on-brand while `brand` (gradient) stays for hero actions.
- **Docs** — added `docs/DESIGN_SYSTEM.md` documenting the tokens, typography,
  dark mode, and motion/accessibility guidance.

## [Unreleased] — CI & deploy hardening (power push #49)

- **Fixed API type error** that kept the CI "Lint & Typecheck" check red: the
  admin media-review queue had two `const [avatars, gigCovers]` queries in the
  same scope (a leftover pre-cursor block shadowed the cursor block). Removed
  the dead duplicate — the sorted/paginated block is used.
- **Gitleaks secret scan is green again** — separately, CI cleaned up two
  previously-red checks:
  - **`presence.service.ts`** — `lastPersist` was flagged by
    `prefer-const` (its properties are mutated but the binding is never
    reassigned); switched `let` → `const`.
  - **Gitleaks** — the scan was failing on a _mix_ of true false positives
    (the base64 `integrity` hash of `tinybench@2.9.0` in `package-lock.json`
    resembling a Slack token, plus `pendingWithdrawals7d`/`failedWithdrawals7d`
    Redis key names) **and** once-committed secrets that were already remediated
    in the working tree (a hardcoded `TOKEN` in `cron.yml`, now `${{ secrets.CRON_TOKEN }}`).
    Added `.gitleaks.toml` (`useDefault` + targeted allowlists) and switched CI
    to `--no-git` (scan the current working tree, so new secret commits are
    still blocked, while already-cleaned history no longer fails the build).
    Verified locally: **"no leaks found"** on a clean tracked-file tree.
- **Fast-fail typecheck in the web deploy** — `vercel.json` now runs
  `npm --workspace @apex-work/web run typecheck` before `next build`, so a type
  error fails the build instantly with a clear `TS2322` message instead of after
  the full 31s webpack compile.

## [Unreleased] — Avatar fix, profile navigation & chat tap-actions (power push #48)

### Fixed

- **Avatar shows empty everywhere** — avatar URLs that were stored as a
  root-relative path (`/v1/uploads/files/<id>`) resolved against the _web_
  origin and 404'd in the browser. `UserAvatar` now resolves media paths against
  the API origin (`resolveMediaUrl`) and sets `referrerPolicy="no-referrer"`, so
  the photo loads on chat headers, gig cards, the profile page, reviews, and
  search. Avatars are also uploaded via the API's self-hosted public gateway so
  they always return a bare-`<img>`-readable absolute URL.
- **Chat profile click → user page** — tapping the header avatar, name, or
  verified badge now reliably routes to `/u/<username>` (added a `router.push`
  fallback so it never gets swallowed by the mobile touch/swipe layer).

### Added

- **Tap-actions in message text** — URLs open in a new tab, `@handles` link to
  that user's profile, and `` `inline code` `` taps copy to clipboard (with a
  toast). Search-hit highlighting still works.
- **"Who reacted" popover** — tap a message's emoji chips to see exactly who
  reacted (avatar, name, `@handle`) with an add/remove toggle. Rows link to the
  member's profile. API now returns per-emoji reactor IDs.
- **Read-receipt rows are clickable** — each person in the read / not-read sheet
  links to their profile page.

## [Unreleased] — Chat power features: read-receipt popover & in-text search highlight (power push #47)

### Added

- **Read-receipt popover** — tap a message's ✓✓ (or the "seen by" avatar row)
  to open a bottom sheet listing exactly **who** has read that message and who
  hasn't yet (names, twitter-style @handles, avatars). Includes a live
  "n seen" count and the message preview.
- **In-text search highlighting** — while searching a conversation, the matching
  text inside each message body is highlighted (yellow on your own bubbles,
  accent on theirs), alongside the existing whole-message highlight.
- Reply-quote preview while typing (already present) confirmed: the "Replying
  to …" quote bar shows above the composer with a cancel (×) button.

## [Unreleased] — Verified badge fix + chat power features (power push #46)

### Fixed

- **Verified badge was clipped** on avatars — the check badge sat inside the
  circular, `overflow-hidden` image container so it was cut off (as seen on the
  "HY" chat header). `UserAvatar` now renders the badge on an outer, non-clipped
  wrapper and sizes it to the avatar, so it's always fully visible. Clicking the
  avatar, badge, or name still opens the user's profile page (`/u/<username>`).

### Added

- **Jump-to-latest chip** — when you scroll up in a thread, a floating "Latest"
  button appears above the composer with a live count of messages that arrived
  while you were away; tap it to jump to the newest message.
- **Double-tap to ❤️** — double-tap any message bubble to quick-react with a
  heart (tap still opens message actions; the first tap of a double-tap no longer
  opens the menu). Includes haptic feedback.

## [Unreleased] — Gig-card avatars, verified flags & media pagination (power push #45)

### Added

- **Verified flags + real avatars on gig cards** — the home/featured gig cards
  (both cover and no-cover variants) now render the owner's real profile photo
  and show the cyan verified check only when the owner is verified. The API
  returns `isVerified` for gig owners across list, detail, recommendations and
  saved-gigs.
- **Media review queue pagination** — the admin Media review tab now pages
  (24/page) via a cursor, with a "Load more" button and a shown-count, so it
  scales to large image libraries.

## [Unreleased] — Verified flags everywhere, group typing, media audit log (power push #44)

### Added

- **Verified flag on more surfaces** — the cyan ring / check badge now also
  appears on **global-search user results** and **review authors** (in addition
  to profile, chat, gigs). The API returns `isVerified` for search users and
  review authors.
- **Group "typing" in the inbox** — the conversation list shows _"Name is
  typing…"_ for group chats (the server relays the typist's first name), while
  DMs keep the plain pulse.
- **Image-approval log in Audit** — the Audit tab now surfaces media actions
  (`MEDIA.REMOVE_AVATAR` / `MEDIA.FLAG_GIG`) with a dedicated filter, a headline
  count, and amber badges so staff can audit every image approval/removal.

### Changed

- **Clickable avatars everywhere** — profile photo and/or name now open the
  user's profile from: chat header, chat bubbles, gig-owner cards, search
  results, and review author rows.

## [Unreleased] — Verified rings, inbox typing, admin media review & import (power push #43)

### Added

- **Verified avatar ring** — verified users (phone + ID) now show a cyan ring
  and a small check badge on their avatar everywhere: public profile, chat
  header, chat bubbles, and gig-owner cards. (`UserAvatar` gained a `verified`
  prop; the API now returns `isVerified` on chat peers/members and gig owners.)
- **Live "typing…" in the inbox** — the conversation list now shows a pulsing
  "typing…" row when a contact is typing, even with the thread closed. The
  server relays typing to each member's private socket room; a lightweight
  `useInboxTyping` hook renders the pulse (auto-clears after 4s).
- **Admin → Media review tab** — a photo-moderation queue listing recent user
  avatars + gig covers with preview, and one-click **Remove avatar** / **Flag
  gig** actions (audited). New endpoints under `/admin/ops/media/*`.
- **Admin → Bulk import users (CSV)** — a "Import" button in the Users tab that
  uploads/pastes a CSV (`fullName, username, phone, email, role, password`) and
  bulk-creates accounts with unique usernames + bcrypt passwords, reporting
  created/skipped rows. Endpoint `/admin/ops/users/import`.

## [Unreleased] — Taller profile hero, header profile link + suggestions (power push #42)

### Changed

- **Taller profile hero banner** — increased the profile cover from ~176px to
  ~240px (≈320px on desktop) so the name and photo breathe.
- **Chat header → profile** — clicking the contact's **photo or name** in the
  chat top bar now opens their public profile (`/u/<username>`). The avatar uses
  the robust `UserAvatar` (real photo, graceful initials fallback on failure).

### Added

- **Photo nudge on your own profile** — if you haven't set a profile picture, a
  friendly banner appears on your public profile with an "Add photo" button
  (localized EN/AM).
- **Quick "Message" from search** — global search user results now have a
  message button to jump straight into a conversation.

## [Unreleased] — Scroll fix, richer profile photos (power push #41)

### Fixed

- **Vertical scrolling broke** — the page-no-pan fix used `overflow-x: hidden`
  on `<html>/<body>`, which on some mobile browsers creates a scroll container
  that disables vertical scrolling. Switched to `overflow-x: clip`, which keeps
  horizontal pan locked **and** restores normal vertical scrolling everywhere.
- **Profile hero washed out the name** — replaced the flat green gradient with a
  deep violet-to-emerald mesh banner that keeps the name/photo legible and looks
  more premium.

### Added

- **Profile photo displayed everywhere** — a reusable `UserAvatar` component now
  shows the real profile image (falling back to gradient + initials) on the
  public profile, gig owner cards, chat bubbles and chat header. Set it once at
  **Settings → Profile** (pick from local storage) and it appears all over the app.
- **"Edit profile" button** on your own public profile (with a camera icon) that
  jumps straight to photo upload.

## [Unreleased] — Header fix, headroom, sender photos & haptics (power push #40)

### Fixed

- **Header shows "Conversation" / "?" instead of the contact** — the header
  derived the peer only from loaded messages, which was null for empty/new
  conversations. It now reads `conv.peer` (from conversation detail) first, so
  the contact's real name and photo show immediately.

### Changed

- **Headroom above the profile** — the chat header now has extra top padding
  (plus the safe-area inset) so the profile avatar/name aren't clipped at the
  top edge.
- **Sender photo in message bubbles** — the small avatar beside incoming
  messages now renders the sender's real profile photo (falling back to
  initials).

### Added

- **Haptic feedback** on swipe-right-to-reply and on long-press-to-reply
  (short vibration tick on supported devices).

## [Unreleased] — Chat header & composer tweaks (power push #39)

### Changed

- **Contact profile shown in the header** — the chat header now shows the
  contact's real profile photo (falling back to initials) and name.
- **Rectangular composer** — the input pill keeps a slight `rounded-2xl` corner
  and a `min-h` so it stays rectangular (not elliptical) as it grows.
- **Counter moved into the pill** — the character counter now lives inline in
  the composer pill (appears near the limit) instead of a side tab.
- **Removed the search icon** from the top bar (search stays in the `...` menu).

### Added

- **Swipe-right → reply** — swipe right on a message bubble on mobile to start
  a reply (distinct from the edge swipe-back).

## [Unreleased] — Chat UX polish + session reliability (power push #38)

### Fixed

- **"Invalid or expired token" on voice messages** — the root cause was the
  15-min access-token lifespan with no auto-refresh. `apiFetch` now silently
  refreshes the session (via the refresh token) and replays the request once,
  so long voice/chat sessions no longer die mid-send.

### Added

- **Live character counter** in the composer (shows `n/4096`, turns amber near
  the limit and red at it); message length is clamped at 4096 chars.
- **Voice hint** — small helper text under the mic (`Hold the mic to record a
voice message`).
- **Animated / GIF-style stickers** — a new "Animated" sticker tab plus a pop
  entrance animation on large stickers sent in chat (free Unicode, no key).
- **Enhanced + cleaned top-nav menu** — grouped into Conversation /
  Notifications / More sections with headers, a new "Search in conversation"
  entry, and all labels localized (Amharic + English).

### Changed

- **Dark-mode pill refinement** — the composer pill uses a translucent surface
  - soft border in dark mode.

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
  - more) of exactly who has read them, with name tooltips.
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
  `next.config`. Sourcemap _source-generation_ disabled so the free-tier build
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
