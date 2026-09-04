-- Per-category fees + KPI threshold watcher.

-- Category table (id = stable slug).
CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "icon" TEXT NOT NULL DEFAULT '📦',
  "feePercent" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");
ALTER TABLE "Category" ADD CONSTRAINT "Category_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- KPI threshold config.
CREATE TABLE "KpiThreshold" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "operator" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "windowDays" INTEGER NOT NULL DEFAULT 7,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "severity" TEXT NOT NULL DEFAULT 'warn',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  CONSTRAINT "KpiThreshold_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KpiThreshold_key_key" ON "KpiThreshold"("key");
CREATE INDEX "KpiThreshold_enabled_key_idx" ON "KpiThreshold"("enabled", "key");
ALTER TABLE "KpiThreshold" ADD CONSTRAINT "KpiThreshold_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fired KPI alerts.
CREATE TABLE "KpiAlert" (
  "id" TEXT NOT NULL,
  "thresholdId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "operator" TEXT NOT NULL,
  "metricValue" DOUBLE PRECISION NOT NULL,
  "thresholdValue" DOUBLE PRECISION NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'warn',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "message" TEXT,
  "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "KpiAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KpiAlert_status_firedAt_idx" ON "KpiAlert"("status", "firedAt" DESC);
CREATE INDEX "KpiAlert_thresholdId_firedAt_idx" ON "KpiAlert"("thresholdId", "firedAt" DESC);
ALTER TABLE "KpiAlert" ADD CONSTRAINT "KpiAlert_thresholdId_fkey" FOREIGN KEY ("thresholdId") REFERENCES "KpiThreshold"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KpiAlert" ADD CONSTRAINT "KpiAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed categories (id = slug) from the shared catalog; feePercent NULL = inherit global.
INSERT INTO "Category" ("id", "label", "icon", "feePercent", "isActive", "sortOrder") VALUES
  ('development', 'Development', '💻', NULL, true, 1),
  ('design', 'Design', '🎨', NULL, true, 2),
  ('writing', 'Writing & Translation', '✍️', NULL, true, 3),
  ('video', 'Video & Animation', '🎬', NULL, true, 4),
  ('marketing', 'Digital Marketing', '📱', NULL, true, 5),
  ('audio', 'Music & Audio', '🎤', NULL, true, 6),
  ('data', 'Data & AI', '📊', NULL, true, 7),
  ('business', 'Business & Admin', '💼', NULL, true, 8);

-- Seed sensible default KPI thresholds (heavily-safe; admins tune in the UI).
INSERT INTO "KpiThreshold" ("id", "key", "label", "operator", "value", "windowDays", "enabled", "severity") VALUES
  ('thr_signups', 'signups7d', 'New signups (7d)', 'lt', 20, 7, true, 'warn'),
  ('thr_gmv', 'gmv7d', 'GMV (7d)', 'lt', 5000, 7, true, 'warn'),
  ('thr_revenue', 'revenue7d', 'Platform revenue (7d)', 'lt', 500, 7, true, 'warn'),
  ('thr_orders', 'orders7d', 'Orders placed (7d)', 'lt', 20, 7, true, 'warn'),
  ('thr_disputes', 'openDisputes', 'Open disputes', 'gt', 3, 0, true, 'warn'),
  ('thr_withdrawals', 'pendingWithdrawals7d', 'Pending withdrawals (7d)', 'gt', 10, 7, true, 'warn'),
  ('thr_abandoned', 'abandonedOrders', 'Abandoned orders', 'gt', 20, 7, true, 'warn'),
  ('thr_failedwithdrawals', 'failedWithdrawals7d', 'Failed withdrawals (7d)', 'gt', 3, 7, true, 'critical');
