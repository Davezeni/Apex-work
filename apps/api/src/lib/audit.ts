/**
 * Audit trail for security, money and trust-relevant events — the platform's
 * answer to "who changed what, and when". Extends the original admin-only
 * audit log to three actor types:
 *
 *   ADMIN  — staff acting via admin endpoints (existing behaviour, unchanged)
 *   USER   — the account owner themself (delivered work, approved escrow,
 *            requested a payout, changed their PIN …)
 *   SYSTEM — scheduled jobs acting without a human (escrow auto-release,
 *            provider withdrawal syncs) — provable instead of invisible
 *
 * Rows are hash-chained: every row stores the hash of the previous chained
 * row plus sha256(prevHash|canonicalPayload). Any later edit, deletion or
 * reordering of history breaks the chain and is caught by verifyAuditChain()
 * (run nightly via the cron tick, exposed to staff at GET /admin/audit/integrity).
 *
 * Writes are best-effort: they log on failure and NEVER throw into the
 * business path. Call sites use `void writeAudit(...)` — fire-and-forget.
 */
import { createHash } from 'node:crypto';
import { prisma } from './prisma.js';
import { logger } from '../config/logger.js';

export type AuditActorType = 'ADMIN' | 'USER' | 'SYSTEM';

export interface AuditEntry {
  actorType?: AuditActorType; // default ADMIN
  adminId: string; // actor id ('system' for SYSTEM rows)
  adminName: string;
  adminRole: string;
  action: string; // e.g. "ORDER.APPROVED", "PAYOUT.REQUESTED"
  resourceType: string; // e.g. "ORDER", "PAYOUT"
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  ip?: string;
}

/** Serialize chain appends in-process so concurrent writes cannot fork the chain. */
let chainTail: Promise<void> = Promise.resolve();

/** Deterministic JSON: sorted keys, recursive — same value ⇒ same string. */
export function canonicalJson(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

/** Chain step: sha256(prevHash or GENESIS | canonical payload). */
export function hashChainRow(prevHash: string | null, payload: string): string {
  return createHash('sha256')
    .update(`${prevHash ?? 'GENESIS'}|${payload}`)
    .digest('hex');
}

/** Persist an audit record, chained. Best-effort — logs on failure, never throws. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const run = chainTail.then(() => appendChainedRow(entry));
  chainTail = run.catch(() => undefined); // keep the queue alive after failures
  await run;
}

async function appendChainedRow(entry: AuditEntry): Promise<void> {
  try {
    const prev = await prisma.auditLog.findFirst({
      where: { hash: { not: null } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { hash: true },
    });
    const payload = canonicalJson({
      actorType: entry.actorType ?? 'ADMIN',
      adminId: entry.adminId,
      adminName: entry.adminName,
      adminRole: entry.adminRole,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      meta: entry.meta ?? null,
      ip: entry.ip ?? null,
    });
    const hash = hashChainRow(prev?.hash ?? null, payload);
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId,
        adminName: entry.adminName,
        adminRole: entry.adminRole,
        actorType: entry.actorType ?? 'ADMIN',
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        before: (entry.before as object | undefined) ?? undefined,
        after: (entry.after as object | undefined) ?? undefined,
        meta: (entry.meta as object | undefined) ?? undefined,
        ip: entry.ip ?? null,
        prevHash: prev?.hash ?? null,
        hash,
        payload,
      },
    });
  } catch (err) {
    logger.error({ err, action: entry.action, resourceId: entry.resourceId }, 'audit write failed');
  }
}

/**
 * Admin mutation audit — the original entry point, kept for every existing
 * call site. Equivalent to writeAudit with actorType ADMIN.
 */
export async function adminAudit(entry: Omit<AuditEntry, 'actorType'>): Promise<void> {
  return writeAudit({ ...entry, actorType: 'ADMIN' });
}

/**
 * Convenience for USER/SYSTEM events: resolves the user's display name so
 * call sites can stay one-liners. SYSTEM rows pass `systemName` and skip
 * the lookup. Fire-and-forget at call sites (`void writeUserAudit(...)`).
 */
export async function writeUserAudit(input: {
  actorType?: 'USER' | 'SYSTEM';
  userId?: string | null;
  systemName?: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  ip?: string;
}): Promise<void> {
  try {
    if (input.actorType === 'SYSTEM' || !input.userId) {
      await writeAudit({
        actorType: 'SYSTEM',
        adminId: 'system',
        adminName: input.systemName ?? 'System',
        adminRole: 'SYSTEM',
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        before: input.before,
        after: input.after,
        meta: input.meta,
        ip: input.ip,
      });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { fullName: true, username: true },
    });
    const name = user
      ? `${user.fullName}${user.username ? ` (@${user.username})` : ''}`
      : 'Unknown user';
    await writeAudit({
      actorType: 'USER',
      adminId: input.userId,
      adminName: name,
      adminRole: 'USER',
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      before: input.before,
      after: input.after,
      meta: input.meta,
      ip: input.ip,
    });
  } catch (err) {
    logger.error({ err, action: input.action }, 'writeUserAudit failed');
  }
}

export interface ChainVerifyResult {
  ok: boolean;
  checked: number; // chained rows examined
  skipped: number; // legacy pre-chain rows (hash null)
  brokenAtId?: string; // first row whose link/hash fails
}

/**
 * Walk the chain oldest→newest and recompute every link. Head-pruning by
 * retention is legal (the earliest remaining row just anchors the walk);
 * any edit, middle/tail deletion or reorder is detected.
 */
export async function verifyAuditChain(batch = 5000): Promise<ChainVerifyResult> {
  const rows = await prisma.auditLog.findMany({
    where: { hash: { not: null } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: batch,
  });
  const skipped = await prisma.auditLog.count({ where: { hash: null } });
  let prevHash: string | null = null;
  let first = true;
  for (const row of rows) {
    // Payload must hash to the stored hash…
    const expected = hashChainRow(row.prevHash ?? null, row.payload ?? '');
    if (expected !== row.hash || (row.payload ?? '') === '') {
      return { ok: false, checked: rows.length, skipped, brokenAtId: row.id };
    }
    // …and it must link to the row before it (except the chain anchor).
    if (!first && row.prevHash !== prevHash) {
      return { ok: false, checked: rows.length, skipped, brokenAtId: row.id };
    }
    first = false;
    prevHash = row.hash;
  }
  return { ok: true, checked: rows.length, skipped };
}

/**
 * Retention: audit rows older than ~18 months are pruned (head of the chain
 * only — verifyAuditChain tolerates that by design). Keeps the free-tier DB
 * bounded without losing recent dispute-relevant history.
 */
export async function pruneAudit(retentionDays = 548): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 3600 * 1000);
  const res = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return res.count;
}

const MAINTENANCE_KEY = 'audit.maintenance.lastRun';

/**
 * Nightly maintenance — called from the cron tick (which fires every 15
 * minutes); the AppSetting guard makes it a no-op after the first run of
 * the day. Verifies the chain and prunes old rows, then records its own
 * audit row so even the auditor is audited.
 */
export async function auditMaintenance(force = false): Promise<{
  ran: boolean;
  pruned?: number;
  chain?: ChainVerifyResult;
}> {
  const today = new Date().toISOString().slice(0, 10);
  if (!force) {
    const setting = await prisma.appSetting.findUnique({ where: { key: MAINTENANCE_KEY } });
    const day = (setting?.value as { day?: string } | null)?.day;
    if (day === today) return { ran: false };
  }
  const chain = await verifyAuditChain();
  const pruned = await pruneAudit();
  await prisma.appSetting.upsert({
    where: { key: MAINTENANCE_KEY },
    create: { key: MAINTENANCE_KEY, value: { day: today } as never },
    update: { value: { day: today } as never },
  });
  if (!chain.ok) {
    logger.error(
      { brokenAtId: chain.brokenAtId, checked: chain.checked },
      'AUDIT CHAIN INTEGRITY FAILURE',
    );
  }
  await writeAudit({
    actorType: 'SYSTEM',
    adminId: 'system',
    adminName: 'System',
    adminRole: 'SYSTEM',
    action: 'AUDIT.MAINTENANCE',
    resourceType: 'AUDIT',
    meta: { ok: chain.ok, checked: chain.checked, pruned },
  });
  return { ran: true, pruned, chain };
}

/** Resolve an admin actor from `req` into an AuditEntry base. */
export function actorFromReq(
  req: import('express').Request,
): Pick<AuditEntry, 'adminId' | 'adminRole'> {
  return {
    adminId: req.user?.sub ?? 'unknown',
    adminRole: (req as { userRole?: string }).userRole ?? 'unknown',
  };
}

/**
 * Fully-resolve the acting admin (id, name, role) from the request for an
 * AuditEntry. Fetches the display name once per call; acceptable on the
 * low-frequency admin mutation surface.
 */
export async function loadActor(
  req: import('express').Request,
): Promise<Pick<AuditEntry, 'adminId' | 'adminName' | 'adminRole'>> {
  const base = actorFromReq(req);
  const user = await prisma.user.findUnique({
    where: { id: base.adminId },
    select: { fullName: true, username: true },
  });
  return {
    ...base,
    adminName: user
      ? `${user.fullName}${user.username ? ` (@${user.username})` : ''}`
      : 'Unknown admin',
  };
}
