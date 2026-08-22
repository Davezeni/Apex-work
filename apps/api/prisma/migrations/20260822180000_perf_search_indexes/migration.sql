-- Performance: full-text-ish search via pg_trgm + targeted hot-path indexes.
-- We use GIN indexes with gin_trgm_ops so `ILIKE '%foo%'` on hot search
-- columns becomes an index scan instead of a seq scan on every keystroke.
-- Safe to re-run: every statement uses IF NOT EXISTS.

-- Extension is idempotent.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Gigs: search on title + tag arrays (arrays already use GIN via @>, but
-- add explicit btree on lower(title) for exact prefixes).
CREATE INDEX IF NOT EXISTS idx_gig_title_trgm ON "Gig" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gig_tags_gin  ON "Gig" USING gin (tags);

-- Jobs: same treatment on title (client-typed search).
CREATE INDEX IF NOT EXISTS idx_job_title_trgm       ON "Job" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_job_description_trgm ON "Job" USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_job_skills_gin       ON "Job" USING gin ("requiredSkills");

-- Users: profile search (browse + @mention prefixes).
CREATE INDEX IF NOT EXISTS idx_user_fullname_trgm ON "User" USING gin ("fullName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_username_trgm ON "User" USING gin (username gin_trgm_ops);

-- Skills (autocomplete): trigram on name for /skills?q= prefix + fuzzy.
CREATE INDEX IF NOT EXISTS idx_skill_name_trgm ON "Skill" USING gin (name gin_trgm_ops);

-- Messages: covering index for the "latest N in conversation" hot query.
-- Prisma already has (conversationId, createdAt desc); this adds INCLUDE
-- of the columns the chat list actually reads to enable index-only scans.
CREATE INDEX IF NOT EXISTS idx_message_conv_created_covering
  ON "Message" ("conversationId", "createdAt" DESC)
  INCLUDE ("senderId", "body", "attachmentType", "attachmentUrl");

-- Notifications unread badge — heavy on every page load.
CREATE INDEX IF NOT EXISTS idx_notification_unread
  ON "Notification" ("userId", "createdAt" DESC)
  WHERE "readAt" IS NULL;

-- Reviews page — fetch by subject, ordered newest.
CREATE INDEX IF NOT EXISTS idx_review_subject_created
  ON "Review" ("subjectId", "createdAt" DESC);

-- Wallet ledger — /wallet page is our most-hit authenticated page for freelancers.
CREATE INDEX IF NOT EXISTS idx_transaction_user_created
  ON "Transaction" ("userId", "createdAt" DESC);
