/**
 * Audit logging for admin mutations. Every state-changing admin endpoint must
 * call `adminAudit()` so the platform can answer "who changed what and when".
 * The write should be part of the same business transaction where practical;
 * at minimum it is fire-and-forget (never throws into the request path).
 */
import { prisma } from './prisma.js';
import { logger } from '../config/logger.js';

export interface AuditEntry {
  adminId: string;
  adminName: string;
  adminRole: string;
  action: string; // e.g. "GIG.MODERATE"
  resourceType: string; // e.g. "GIG"
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  ip?: string;
}

/** Persist an audit record. Best-effort — logs on failure, never throws. */
export async function adminAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: entry.adminId,
        adminName: entry.adminName,
        adminRole: entry.adminRole,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        before: (entry.before as object | undefined) ?? undefined,
        after: (entry.after as object | undefined) ?? undefined,
        meta: (entry.meta as object | undefined) ?? undefined,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, action: entry.action, resourceId: entry.resourceId }, 'adminAudit write failed');
  }
}

/** Resolve an admin actor from `req` into an AuditEntry base. */
export function actorFromReq(req: import('express').Request): Pick<
  AuditEntry,
  'adminId' | 'adminRole'
> {
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
): Promise<{ adminId: string; adminName: string; adminRole: string }> {
  const base = actorFromReq(req);
  let adminName = base.adminId;
  try {
    const u = await prisma.user.findUnique({
      where: { id: base.adminId },
      select: { fullName: true, username: true },
    });
    adminName = u ? `${u.fullName} (@${u.username})` : base.adminId;
  } catch {
    /* fall back to id */
  }
  return { ...base, adminName };
}
