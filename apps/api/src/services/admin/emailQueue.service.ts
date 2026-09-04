/**
 * Admin email-queue monitor.
 *
 * Reads the durable `EmailQueue` and returns bucket counts (queued / sent /
 * failed), recent rows, a delivery-success rate, and the top failing
 * recipients & subjects. Includes a manual flush trigger so an operator can
 * retry queued mail without waiting for the cron tick.
 */
import { prisma } from '../../lib/prisma.js';
import { flushPending } from '../email.service.js';

export async function emailQueueStatus(limit = 50) {
  const [queued, sent, failed, recent] = await Promise.all([
    prisma.emailQueue.count({ where: { status: 'QUEUED' } }),
    prisma.emailQueue.count({ where: { status: 'SENT' } }),
    prisma.emailQueue.count({ where: { status: 'FAILED' } }),
    prisma.emailQueue.findMany({
      select: { id: true, to: true, subject: true, status: true, attempts: true, lastError: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ]);

  // Top failing recipients and subjects (for the last 200 failed).
  const failedRows = await prisma.emailQueue.findMany({
    where: { status: 'FAILED' },
    select: { to: true, subject: true, lastError: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const byRecipient = new Map<string, number>();
  const bySubject = new Map<string, number>();
  const errors = new Map<string, number>();
  for (const f of failedRows) {
    byRecipient.set(f.to, (byRecipient.get(f.to) ?? 0) + 1);
    bySubject.set(f.subject, (bySubject.get(f.subject) ?? 0) + 1);
    const key = (f.lastError ?? 'unknown').slice(0, 80);
    errors.set(key, (errors.get(key) ?? 0) + 1);
  }
  const topFailures = [...errors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([error, count]) => ({ error, count }));

  const total = queued + sent + failed;
  const deliveryRate = sent + failed > 0 ? sent / (sent + failed) : 0;

  return {
    counts: { queued, sent, failed, total },
    deliveryRate,
    recent,
    topFailures,
    topRecipients: [...byRecipient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([to, count]) => ({ to, count })),
    topSubjects: [...bySubject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([subject, count]) => ({ subject, count })),
  };
}

export async function flushQueue() {
  const result = await flushPending(1000);
  return result;
}
