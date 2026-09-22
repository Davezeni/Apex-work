-- Audit trail v2: generalize actors (ADMIN/USER/SYSTEM) + tamper-evident
-- hash chain. Additive only — the existing table keeps its name and data.
ALTER TABLE "AdminAuditLog" ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "AdminAuditLog" ADD COLUMN "prevHash" TEXT;
ALTER TABLE "AdminAuditLog" ADD COLUMN "hash" TEXT;
ALTER TABLE "AdminAuditLog" ADD COLUMN "payload" TEXT;

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorType_createdAt_idx" ON "AdminAuditLog"("actorType", "createdAt" DESC);
