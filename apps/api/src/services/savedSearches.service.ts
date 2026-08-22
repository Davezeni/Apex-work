/**
 * Saved searches. User creates a query + type (GIGS/JOBS/USERS) + optional
 * category filter. A background scan (`checkAllSavedSearches`) runs every
 * ~15 min via a cron endpoint and finds rows newer than each saved search's
 * `lastCheckedAt`, then pushes / emails the user with a summary.
 *
 * We only count NEW rows (created after lastCheckedAt) — the query text
 * is trusted to already select the right subset.
 */
import type { SavedSearchType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import { notify } from './notifications.service.js';
import { sendPush } from './push.service.js';

export async function create(userId: string, input: {
  name: string; type: SavedSearchType; query: string;
  category?: string; emailEnabled: boolean; pushEnabled: boolean;
}) {
  return prisma.savedSearch.create({
    data: {
      userId,
      name: input.name,
      type: input.type,
      query: input.query,
      category: input.category ?? null,
      emailEnabled: input.emailEnabled,
      pushEnabled: input.pushEnabled,
    },
  });
}

export async function listMine(userId: string) {
  return prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function update(id: string, userId: string, patch: {
  name?: string; emailEnabled?: boolean; pushEnabled?: boolean;
}) {
  const row = await prisma.savedSearch.findUnique({ where: { id }, select: { userId: true } });
  if (!row) throw new NotFoundError('Saved search');
  if (row.userId !== userId) throw new ForbiddenError();
  return prisma.savedSearch.update({ where: { id }, data: patch });
}

export async function remove(id: string, userId: string) {
  const row = await prisma.savedSearch.findUnique({ where: { id }, select: { userId: true } });
  if (!row) throw new NotFoundError('Saved search');
  if (row.userId !== userId) throw new ForbiddenError();
  await prisma.savedSearch.delete({ where: { id } });
  return { ok: true };
}

/**
 * Scan every saved search and notify owners about new hits. Called by a
 * cron endpoint (GitHub Actions hits `/v1/cron/saved-searches` every 15m).
 * Kept cheap: single COUNT per row + update lastCheckedAt.
 */
export async function checkAllSavedSearches(): Promise<{ scanned: number; hits: number }> {
  const rows = await prisma.savedSearch.findMany({ take: 500 });
  let hits = 0;
  for (const s of rows) {
    const since = s.lastCheckedAt;
    const now = new Date();
    let count = 0;
    let recentSample = '';

    if (s.type === 'GIGS') {
      const list = await prisma.gig.findMany({
        where: {
          status: 'ACTIVE',
          createdAt: { gt: since },
          ...(s.category ? { categoryId: s.category } : {}),
          OR: [
            { title: { contains: s.query, mode: 'insensitive' } },
            { tags: { has: s.query.toLowerCase() } },
          ],
        },
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { title: true },
      });
      count = list.length;
      recentSample = list[0]?.title ?? '';
    } else if (s.type === 'JOBS') {
      const list = await prisma.job.findMany({
        where: {
          isOpen: true,
          createdAt: { gt: since },
          ...(s.category ? { categoryId: s.category } : {}),
          OR: [
            { title: { contains: s.query, mode: 'insensitive' } },
            { description: { contains: s.query, mode: 'insensitive' } },
            { requiredSkills: { has: s.query.toLowerCase() } },
          ],
        },
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { title: true },
      });
      count = list.length;
      recentSample = list[0]?.title ?? '';
    } else if (s.type === 'USERS') {
      const list = await prisma.user.findMany({
        where: {
          isActive: true,
          createdAt: { gt: since },
          OR: [
            { fullName: { contains: s.query, mode: 'insensitive' } },
            { title: { contains: s.query, mode: 'insensitive' } },
          ],
        },
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { fullName: true },
      });
      count = list.length;
      recentSample = list[0]?.fullName ?? '';
    }

    if (count > 0) {
      hits += count;
      const url =
        s.type === 'GIGS' ? `/browse?q=${encodeURIComponent(s.query)}` :
        s.type === 'JOBS' ? `/jobs?q=${encodeURIComponent(s.query)}` :
                             `/search?q=${encodeURIComponent(s.query)}`;
      await notify({
        userId: s.userId,
        type: 'SYSTEM',
        title: `${count} new match${count === 1 ? '' : 'es'} for "${s.name}"`,
        body: recentSample.slice(0, 140),
        payload: { savedSearchId: s.id, count },
      });
      if (s.pushEnabled) {
        void sendPush(s.userId, {
          title: `${count} new match${count === 1 ? '' : 'es'} for "${s.name}"`,
          body: recentSample.slice(0, 140),
          url,
          tag: `saved-${s.id}`,
        });
      }
    }

    await prisma.savedSearch.update({
      where: { id: s.id },
      data: { lastCheckedAt: now },
    });
  }
  return { scanned: rows.length, hits };
}
