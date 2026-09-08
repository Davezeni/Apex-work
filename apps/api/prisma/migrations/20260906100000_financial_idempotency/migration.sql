-- Database-level financial idempotency.
--
-- A given money event (user + transaction type + related business record) must be
-- recordable at most once. This makes retried/duplicate webhooks, callback
-- verifications and cron runs unable to double-credit or double-debit a wallet.

-- 1) Add a non-financial marker type for auto-release reminders. Reminders are
--    0-amount and must not collide with the client's real ORDER_PAYMENT row for
--    the same order under the new idempotency key.
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'ESCROW_REMINDER';

-- 2) De-duplicate any pre-existing (userId, type, relatedId) rows that were
--    written before the idempotency constraint existed. The most common case is
--    the old 0-amount ORDER_PAYMENT reminder marker colliding with the genuine
--    payment entry for the same order; we keep the earliest row (the real one)
--    and drop the later duplicate marker. relatedId IS NULL rows are unaffected
--    (Postgres treats NULLs as distinct in unique indexes).
DELETE FROM "Transaction" a
USING "Transaction" b
WHERE a."userId" = b."userId"
  AND a."type" = b."type"
  AND a."relatedId" = b."relatedId"
  AND a."relatedId" IS NOT NULL
  AND (a."createdAt", a."id") > (b."createdAt", b."id");

-- 3) Enforce it at the database level.
CREATE UNIQUE INDEX "Transaction_userId_type_relatedId_key"
  ON "Transaction"("userId", "type", "relatedId");
