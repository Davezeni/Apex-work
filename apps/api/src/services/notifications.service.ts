/**
 * Notifications: persistence + realtime fanout.
 *
 * A notification is durable (Notification row) so the user sees it on
 * next login even if they were offline. When Socket.io is available we
 * also push it to the user's `user:{userId}` room for instant UI.
 */
import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { getIo } from '../realtime/socket.js';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesSchema,
} from '@apex-work/shared';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  payload?: Prisma.InputJsonValue;
}

type PreferenceKey = keyof typeof DEFAULT_NOTIFICATION_PREFERENCES;

const preferenceForType: Record<NotificationType, PreferenceKey> = {
  NEW_MESSAGE: 'messages',
  NEW_BID: 'orders',
  ORDER_UPDATE: 'orders',
  PAYMENT: 'payments',
  REVIEW: 'reviews',
  SYSTEM: 'system',
};

async function isEnabled(userId: string, type: NotificationType): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefsJson: true },
    });
    const parsed = notificationPreferencesSchema.safeParse(user?.notificationPrefsJson ?? {});
    const preferences = parsed.success ? parsed.data : DEFAULT_NOTIFICATION_PREFERENCES;
    return preferences[preferenceForType[type]];
  } catch (err) {
    // Preference lookup must never block important order/payment events.
    logger.warn({ err, userId, type }, 'notification preference lookup failed; allowing notification');
    return true;
  }
}

export async function notify(input: NotifyInput) {
  if (!(await isEnabled(input.userId, input.type))) return null;
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        payload: input.payload,
      },
    });

    // Broadcast to the user's socket room. Fire-and-forget: never block.
    const io = getIo();
    if (io) io.to(`user:${input.userId}`).emit('notification:new', notification);

    return notification;
  } catch (err) {
    // Never let a notification failure break the calling business logic.
    logger.error({ err, input }, 'notify() failed');
    return null;
  }
}

export async function listUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(
  userId: string,
  opts: { cursor?: string; limit: number } = { limit: 30 },
) {
  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > opts.limit;
  const trimmed = hasMore ? items.slice(0, opts.limit) : items;
  return {
    items: trimmed,
    nextCursor: hasMore ? (trimmed[trimmed.length - 1]?.id ?? null) : null,
    hasMore,
  };
}

export async function markAllRead(userId: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count;
}

export async function markOneRead(userId: string, id: string) {
  return prisma.notification.updateMany({
    where: { userId, id, readAt: null },
    data: { readAt: new Date() },
  });
}
