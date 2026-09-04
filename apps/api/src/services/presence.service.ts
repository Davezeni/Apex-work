/**
 * Lightweight presence tracker.
 *
 * Runs in-process so the HTTP handlers and Socket.io handlers share the same
 * Map (single-instance deploy). Each user's last heartbeat is stored; a peer is
 * "online" when its heartbeat is younger than ONLINE_WINDOW_MS. We also rely on
 * `User.lastSeenAt` as a durable fallback for users who closed the app without
 * a clean disconnect.
 */

const ONLINE_WINDOW_MS = 20_000;

const heartbeats = new Map<string, number>();

export function markOnline(userId: string): void {
  heartbeats.set(userId, Date.now());
}

export function markOffline(userId: string): void {
  heartbeats.delete(userId);
}

export function isOnline(userId: string): boolean {
  const t = heartbeats.get(userId);
  return !!t && Date.now() - t < ONLINE_WINDOW_MS;
}

export function onlineUserIds(): Set<string> {
  const now = Date.now();
  const out = new Set<string>();
  for (const [uid, t] of heartbeats) {
    if (now - t < ONLINE_WINDOW_MS) out.add(uid);
  }
  return out;
}

/** Throttled DB write so presence survives a redeploy/restart. */
let lastPersist: Record<string, number> = {};
export function maybePersistLastSeen(userId: string): void {
  const now = Date.now();
  if ((lastPersist[userId] ?? 0) < now - 60_000) {
    lastPersist[userId] = now;
    void (async () => {
      try {
        const { prisma } = await import('../lib/prisma.js');
        await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});
      } catch {
        /* best-effort */
      }
    })();
  }
}

export function presenceStats(): { online: number } {
  return { online: onlineUserIds().size };
}
