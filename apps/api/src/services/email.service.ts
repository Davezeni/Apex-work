/**
 * Email delivery. Uses Resend (https://resend.com) — 100 emails/day free
 * without a domain, unlimited with a verified sender.
 *
 * Every send goes into the EmailQueue first (durable) so a Resend outage
 * never loses an alert. A cron worker (`/v1/cron/emails`) flushes QUEUED
 * rows. Callers can also `enqueue()` which enqueues + immediately flushes.
 *
 * The last delivery error is kept in-memory (`lastError`) and surfaced
 * via the admin Diagnostics panel — makes debugging domain/verification
 * issues trivial.
 */
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const RESEND_URL = 'https://api.resend.com/emails';

let lastError: { at: string; message: string; to: string } | null = null;
let lastSuccess: { at: string; to: string; providerId?: string } | null = null;

export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

export function emailDebug() {
  return {
    configured: isEmailConfigured(),
    from: env.EMAIL_FROM,
    lastError,
    lastSuccess,
  };
}

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Enqueue + attempt immediately. Returns { id, delivered, error } so
 * callers can surface a real result to the UI (previously we always
 * returned success, hiding failures).
 */
export async function enqueue(input: EmailInput): Promise<{ id: string; delivered: boolean; error?: string }> {
  const row = await prisma.emailQueue.create({
    data: {
      to: input.to,
      subject: input.subject,
      html: input.html,
      status: 'QUEUED',
    },
  });
  const result = await tryDeliver(row);
  return { id: row.id, delivered: result.ok, error: result.error };
}

async function tryDeliver(row: { id: string; to: string; subject: string; html: string; attempts: number }): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) return { ok: false, error: 'RESEND_API_KEY not set' };
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [row.to],
        subject: row.subject,
        html: row.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    lastSuccess = { at: new Date().toISOString(), to: row.to, providerId: body.id };
    lastError = null;
    logger.info({ id: row.id, providerId: body.id, to: row.to }, 'email sent');
    return { ok: true };
  } catch (err) {
    const message = (err as Error).message || 'unknown';
    lastError = { at: new Date().toISOString(), to: row.to, message: message.slice(0, 500) };
    logger.warn({ id: row.id, message }, 'email send failed');
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: {
        attempts: row.attempts + 1,
        lastError: message.slice(0, 500),
        status: row.attempts + 1 >= 5 ? 'FAILED' : 'QUEUED',
      },
    });
    return { ok: false, error: message };
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
    const r = await tryDeliver(row);
    if (r.ok) sent++;
  }
  return { scanned: rows.length, sent };
}
