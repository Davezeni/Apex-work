import { prisma } from '../lib/prisma.js';
import type { ProfileEventType } from '@prisma/client';

export function recordEvent(input: {
  subjectUserId: string;
  type: ProfileEventType;
  viewerId?: string;
  targetId?: string;
}) {
  // Public page telemetry must never delay the page response.
  return prisma.profileEvent
    .create({
      data: {
        subjectUserId: input.subjectUserId,
        type: input.type,
        viewerId: input.viewerId ?? null,
        targetId: input.targetId ?? null,
      },
    })
    .catch(() => undefined);
}

export async function dashboard(userId: string) {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [counts, recent] = await Promise.all([
    prisma.profileEvent.groupBy({
      by: ['type'],
      where: { subjectUserId: userId, createdAt: { gte: from } },
      _count: { _all: true },
    }),
    prisma.profileEvent.findMany({
      where: { subjectUserId: userId, createdAt: { gte: from } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { type: true, createdAt: true },
    }),
  ]);
  const count = (type: ProfileEventType) =>
    counts.find((item) => item.type === type)?._count._all ?? 0;
  const daily = new Map<string, number>();
  for (const event of recent) {
    const key = event.createdAt.toISOString().slice(0, 10);
    daily.set(key, (daily.get(key) ?? 0) + 1);
  }
  const series = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.now() - (29 - index) * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    return { day: key, events: daily.get(key) ?? 0 };
  });
  return {
    range: '30d',
    totals: {
      profileViews: count('PROFILE_VIEW'),
      cvViews: count('CV_VIEW'),
      cvDownloads: count('CV_DOWNLOAD'),
      portfolioViews: count('PORTFOLIO_VIEW'),
      portfolioDownloads: count('PORTFOLIO_DOWNLOAD'),
    },
    series,
  };
}
