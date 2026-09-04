/**
 * KPI threshold watcher.
 *
 * A scheduled/job endpoint computes a dashboard KPI set and compares each
 * against a configurable `KpiThreshold`. A breach creates (or re-opens) a
 * `KpiAlert` so admins can see and acknowledge it. Deduped per key — only
 * one OPEN alert exists per threshold at a time; once acknowledged the alert
 * stays until the metric recovers (status -> RESOLVED when it no longer
 * breaches and an alert had been open/accepted).
 */
import { prisma } from '../lib/prisma.js';

export type KpiKey =
  | 'signups7d'
  | 'gmv7d'
  | 'revenue7d'
  | 'orders7d'
  | 'openDisputes'
  | 'pendingWithdrawals7d'
  | 'abandonedOrders'
  | 'failedWithdrawals7d';

interface KpiMetric {
  key: KpiKey;
  label: string;
  value: number;
  unit: string;
}

/** Compute the current value of every watched KPI. */
export async function computeKpis(now = new Date()): Promise<KpiMetric[]> {
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sinceD7 = { gte: d7 };

  const [
    signups7d,
    orders7d,
    completedGmv,
    createdGmv,
    openDisputes,
    pendingWithdrawals7d,
    abandonedOrders,
    failedWithdrawals7d,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: sinceD7 } }),
    prisma.order.count({ where: { createdAt: sinceD7 } }),
    prisma.order.aggregate({
      _sum: { amountEtb: true, platformFeeEtb: true },
      where: { status: 'COMPLETED', createdAt: sinceD7 },
    }),
    prisma.order.aggregate({
      _sum: { amountEtb: true },
      where: { createdAt: sinceD7 },
    }),
    prisma.dispute.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
    prisma.withdrawal.count({
      where: { status: { in: ['PENDING', 'PROCESSING'] }, createdAt: sinceD7 },
    }),
    prisma.order.count({
      where: { createdAt: sinceD7, status: 'PENDING' },
    }),
    prisma.withdrawal.count({
      where: { status: 'FAILED', createdAt: sinceD7 },
    }),
  ]);

  return [
    { key: 'signups7d', label: 'New signups (7d)', value: signups7d, unit: '' },
    { key: 'gmv7d', label: 'GMV created (7d)', value: createdGmv._sum.amountEtb ?? 0, unit: 'ETB' },
    { key: 'revenue7d', label: 'Revenue (7d)', value: completedGmv._sum.platformFeeEtb ?? 0, unit: 'ETB' },
    { key: 'orders7d', label: 'Orders placed (7d)', value: orders7d, unit: '' },
    { key: 'openDisputes', label: 'Open disputes', value: openDisputes, unit: '' },
    { key: 'pendingWithdrawals7d', label: 'Pending withdrawals (7d)', value: pendingWithdrawals7d, unit: '' },
    { key: 'abandonedOrders', label: 'Abandoned (unpaid) orders (7d)', value: abandonedOrders, unit: '' },
    { key: 'failedWithdrawals7d', label: 'Failed withdrawals (7d)', value: failedWithdrawals7d, unit: '' },
  ];
}

function breaches(op: string, metric: number, threshold: number): boolean {
  if (op === 'lt') return metric < threshold;
  if (op === 'gt') return metric > threshold;
  return false;
}

/**
 * Evaluate every enabled threshold against the current KPIs and fire/close
 * alerts. Idempotent — safe to call every cron tick.
 */
export async function checkKpiThresholds(now = new Date()): Promise<{ checked: number; fired: number; resolved: number }> {
  const [thresholds, metrics] = await Promise.all([
    prisma.kpiThreshold.findMany({ where: { enabled: true } }),
    computeKpis(now),
  ]);
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  let fired = 0;
  let resolved = 0;

  for (const thr of thresholds) {
    const metric = byKey.get(thr.key as KpiKey);
    if (!metric) continue;
    const breached = breaches(thr.operator, metric.value, thr.value);

    // Existing OPEN or ACKNOWLEDGED alert (still unresolved) for this threshold.
    const open = await prisma.kpiAlert.findFirst({
      where: { thresholdId: thr.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      orderBy: { firedAt: 'desc' },
    });

    if (breached) {
      if (!open) {
        await prisma.kpiAlert.create({
          data: {
            thresholdId: thr.id,
            key: thr.key,
            label: metric.label,
            operator: thr.operator,
            metricValue: metric.value,
            thresholdValue: thr.value,
            severity: thr.severity,
            message: `${metric.label} is ${metric.value}${metric.unit ? ' ' + metric.unit : ''} (threshold ${thr.operator === 'lt' ? 'below' : 'above'} ${thr.value})`,
            status: 'OPEN',
          },
        });
        fired += 1;
      }
    } else if (open && open.resolvedAt === null) {
      // Metric recovered; resolve the open/acknowledged alert.
      await prisma.kpiAlert.update({
        where: { id: open.id },
        data: { status: 'RESOLVED', resolvedAt: now },
      });
      resolved += 1;
    }
  }

  return { checked: thresholds.length, fired, resolved };
}

/** List alerts (optionally filtered by status), newest first. */
export async function listKpiAlerts(status?: string, limit = 50) {
  return prisma.kpiAlert.findMany({
    where: status && status !== 'ALL' ? { status } : {},
    orderBy: { firedAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
    include: { acknowledgedBy: { select: { fullName: true, username: true } } },
  });
}

/** List thresholds + their current computed value + unresolved alert presence. */
export async function listKpiThresholds() {
  const [thresholds, metrics, alerts] = await Promise.all([
    prisma.kpiThreshold.findMany({
      orderBy: { key: 'asc' },
      include: { updatedBy: { select: { fullName: true, username: true } } },
    }),
    computeKpis(),
    prisma.kpiAlert.findMany({
      where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      select: { id: true, key: true, status: true },
    }),
  ]);
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const openByKey = new Map(alerts.map((a) => [a.key, a]));
  return thresholds.map((t) => {
    const metric = byKey.get(t.key as KpiKey);
    return {
      id: t.id,
      key: t.key,
      label: t.label,
      operator: t.operator,
      value: t.value,
      windowDays: t.windowDays,
      enabled: t.enabled,
      severity: t.severity,
      currentValue: metric?.value ?? null,
      unit: metric?.unit ?? '',
      hasOpenAlert: !!openByKey.get(t.key),
      openAlertStatus: openByKey.get(t.key)?.status ?? null,
      updatedAt: t.updatedAt,
      updatedByName: t.updatedBy ? `${t.updatedBy.fullName} (@${t.updatedBy.username})` : null,
    };
  });
}

/** Update a threshold (enabled/operator/value/severity). */
export async function updateKpiThreshold(
  id: string,
  update: { value?: number; operator?: 'lt' | 'gt'; enabled?: boolean; severity?: string },
  updatedById: string,
) {
  const existing = await prisma.kpiThreshold.findUnique({ where: { id } });
  if (!existing) throw new Error('Threshold not found');
  return prisma.kpiThreshold.update({
    where: { id },
    data: {
      ...(update.value !== undefined ? { value: update.value } : {}),
      ...(update.operator ? { operator: update.operator } : {}),
      ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
      ...(update.severity ? { severity: update.severity } : {}),
      updatedById,
    },
  });
}

/** Acknowledge an alert (marks it ACKNOWLEDGED, records who + when). */
export async function acknowledgeKpiAlert(id: string, adminId: string) {
  const existing = await prisma.kpiAlert.findUnique({ where: { id } });
  if (!existing) throw new Error('Alert not found');
  return prisma.kpiAlert.update({
    where: { id },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedById: adminId },
  });
}
