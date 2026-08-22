/**
 * Web Push notifications.
 *
 * Uses VAPID keys so we don't need FCM/APNS credentials. Every user can
 * be subscribed on multiple devices — one PushSubscription row per
 * endpoint. On send we try every subscription in parallel; any that fail
 * with 404/410 are pruned (the browser has told us the endpoint is dead).
 *
 * VAPID keys live in env (VAPID_PUBLIC / VAPID_PRIVATE / VAPID_SUBJECT).
 * If not configured, sendPush() is a silent no-op — never break the app.
 */
import webpush from 'web-push';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let configured = false;

if (env.VAPID_PUBLIC && env.VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT ?? 'mailto:support@apex-work.com',
      env.VAPID_PUBLIC,
      env.VAPID_PRIVATE,
    );
    configured = true;
  } catch (err) {
    logger.error({ err }, 'VAPID setup failed — push disabled');
  }
}

export function isPushConfigured(): boolean {
  return configured;
}

export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC ?? null;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

/**
 * Save a subscription for a user. Endpoint is the natural key — if the
 * same browser subscribes again we just update the auth keys.
 */
export async function subscribe(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  authKey: string;
  userAgent?: string;
}) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      authKey: input.authKey,
      userAgent: input.userAgent ?? null,
    },
    update: {
      userId: input.userId,
      p256dh: input.p256dh,
      authKey: input.authKey,
      lastSeenAt: new Date(),
      userAgent: input.userAgent ?? null,
    },
  });
}

/** Remove a subscription (user disabled push in this browser). */
export async function unsubscribe(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/** Push a notification to ALL of a user's devices. Silent no-op if push is unconfigured. */
export async function sendPush(userId: string, payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  if (!configured) return { sent: 0, pruned: 0 };
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.authKey } },
          body,
          { TTL: 60 * 60 * 24 },
        );
        sent++;
        // Refresh lastSeenAt so we can prune truly-stale subs later.
        prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } })
          .catch(() => undefined);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Endpoint dead — prune.
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
          pruned++;
        } else {
          logger.warn({ err, endpoint: s.endpoint.slice(0, 60) }, 'push send failed');
        }
      }
    }),
  );

  return { sent, pruned };
}
