-- CSAT on support tickets.
ALTER TABLE "SupportTicket"
  ADD COLUMN "csatRating" INTEGER,
  ADD COLUMN "csatComment" TEXT,
  ADD COLUMN "csatScoredAt" TIMESTAMP(3);

CREATE INDEX "SupportTicket_csatScoredAt_idx" ON "SupportTicket"("csatScoredAt");

-- Referral click tracking (tracked share links).
CREATE TABLE "ReferralClick" (
  "id"         TEXT NOT NULL,
  "refCode"    TEXT NOT NULL,
  "source"     TEXT NOT NULL DEFAULT 'link',
  "referrerId" TEXT,
  "clickedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReferralClick_refCode_clickedAt_idx" ON "ReferralClick"("refCode", "clickedAt" DESC);
CREATE INDEX "ReferralClick_referrerId_clickedAt_idx" ON "ReferralClick"("referrerId", "clickedAt" DESC);

ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_referrerId_fkey"
  FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
