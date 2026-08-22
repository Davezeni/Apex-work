/**
 * Email delivery. Uses Resend (https://resend.com) — 100 emails/day free
 * without a domain, unlimited with a verified sender.
 *
 * Every send goes into the EmailQueue first (durable) so a Resend outage
 * never loses an alert. A cron worker (`/v1/cron/emails`) flushes QUEUED
 * rows. Callers can also `send()` inline which enqueues + immediately
 * flushes.
 */
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const RESEND_URL = 'https://api.resend.com/emails';

export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function enqueue(input: EmailInput): Promise<{ id: string }> {
  const row = await prisma.emailQueue.create({
    data: {
      to: input.to,
      subject: input.subject,
      html: input.html,
      status: 'QUEUED',
    },
  });
  // Fire-and-forget flush attempt so latency-sensitive notifications
  // don't wait for the next cron tick.
  void flushOne(row.id).catch(() => undefined);
  return { id: row.id };
}

async function flushOne(id: string): Promise<void> {
  if (!isEmailConfigured()) return;
  const row = await prisma.emailQueue.findUnique({ where: { id } });
  if (!row || row.status !== 'QUEUED') return;
  await tryDeliver(row);
}

async function tryDeliver(row: { id: string; to: string; subject: string; html: string; attempts: number }): Promise<void> {
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM ?? 'Apex-Work <noreply@apex-work.com>',
        to: row.to,
        subject: row.subject,
        html: row.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (err) {
    const message = (err as Error).message || 'unknown';
    logger.warn({ id: row.id, message }, 'email send failed');
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: {
        attempts: row.attempts + 1,
        lastError: message.slice(0, 500),
        status: row.attempts + 1 >= 5 ? 'FAILED' : 'QUEUED',
      },
    });
  }
}

/** Flush up to N pending emails. Called by /v1/cron/emails every 5 min. */
export async function flushPending(limit = 50): Promise<{ scanned: number; sent: number }> {
  if (!isEmailConfigured()) return { scanned: 0, sent: 0 };
  const rows = await prisma.emailQueue.findMany({
    where: { status: 'QUEUED', attempts: { lt: 5 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  let sent = 0;
  for (const row of rows) {
    const before = row.status;
    await tryDeliver(row);
    const after = await prisma.emailQueue.findUnique({ where: { id: row.id }, select: { status: true } });
    if (before !== after?.status && after?.status === 'SENT') sent++;
  }
  return { scanned: rows.length, sent };
}
