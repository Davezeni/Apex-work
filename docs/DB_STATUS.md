# 🗄️ Database Status

_Snapshot: 2026-08-21_

## Provider

- **Host:** Neon Postgres 18.6 · `eu-central-1` (Frankfurt)
- **Connection:** pooled `DATABASE_URL` (app), direct `DATABASE_URL_UNPOOLED` (migrations)
- **Plan:** Free tier (3 GB storage cap; current usage ≈ 9 MB, so we have >99% headroom)

## Tables

The schema now has **17 tables** covering identity, marketplace, chat, payments, and (new) security.

| Domain | Tables |
|---|---|
| Identity | `User`, `RefreshToken`, `Session`, `Otp` |
| Security *(new)* | `TrustedDevice`, `Passkey`, `User.pinHash` |
| Skills & Portfolio | `Skill`, `UserSkill`, `PortfolioItem` |
| Marketplace | `Gig`, `GigPackage`, `Job`, `Bid` |
| Transactions | `Order`, `Payment`, `Wallet`, `Transaction` |
| Reviews | `Review` |
| Chat | `Conversation`, `ConversationMember`, `Message` |
| Notifications | `Notification` |

## Migration history

```
20260820220951_init                          — initial schema
20260821191243_trusted_devices_and_passkeys  — adds User.pinHash, TrustedDevice, Passkey
```

Migrations are versioned in `apps/api/prisma/migrations/*`. Render now auto-applies them on every deploy via the `preDeployCommand` in `render.yaml` (runs `npm run db:migrate:deploy` against the direct/unpooled connection when provided).

## Indexes

47 custom indexes across the schema, all defined declaratively in `schema.prisma`:
- `@@unique` on natural keys (phone, email, username, token hashes, credential IDs)
- `@@index` on hot filter/sort fields (`Gig.status`, `Order.status`, `Conversation.lastMessageAt`, etc.)

No manual index tuning needed — Prisma keeps the DB in sync with the schema.

## Data at a glance (last 7 days)

- New signups: 3
- OTPs sent: 10
- Messages sent: 0
- Orders created: 0
- **Total rows across all tables:** 38

## What's next for the DB

**Short-term (deferred to next turn):**
1. **Portfolio uploads** → `PortfolioItem` gets real image URLs via Cloudflare R2 presigned uploads.
2. **Reviews** → wire the `Review` model to the order flow (client rates after `COMPLETED`).
3. **Withdrawals** → freelancer wallet payout via Telebirr (Chapa's B2C API).

**Medium-term:**
4. **Full-text search** → Postgres `pg_trgm` index on `Gig.title` for fast typeahead. Currently we use `ILIKE %q%` which is fine at hundreds of rows but O(n).
5. **Read replicas** → Neon supports branching; add a read-only branch when analytics get heavy.
6. **Cold-storage messages** → old chat messages moved to a cheaper store after 12 months.

**Ops:**
- No manual backups needed — Neon retains 7 days of point-in-time recovery on the free tier.
- Monitor connection count via `pg_stat_activity`; the pooler handles up to 10K connections.
- If we ever move off Neon, `pg_dump` from `DATABASE_URL_UNPOOLED` gives a portable dump.
