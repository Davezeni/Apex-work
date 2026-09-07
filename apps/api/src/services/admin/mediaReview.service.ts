import type { UserRole } from '@apex-work/shared';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';

export type MediaItem =
  | {
      kind: 'avatar';
      refId: string;
      url: string;
      ownerName: string;
      ownerUsername: string;
      ownerRole: UserRole;
      createdAt: Date;
    }
  | {
      kind: 'gigCover';
      refId: string;
      url: string;
      ownerName: string;
      ownerUsername: string;
      ownerRole: UserRole;
      title: string;
      gigId: string;
      createdAt: Date;
    };

export interface MediaQueue {
  /** How many items were pulled for review (capped by limit). */
  total: number;
  items: MediaItem[];
  nextCursor: string | null;
}

/**
 * List user avatars + gig covers for the admin photo-review queue. Returns the
 * most recently uploaded images so content stays fresh. No external provider —
 * everything is a Supabase publicUrl already stored on the row.
 *
 * Supports cursor pagination: `cursor` is an ISO timestamp (the oldest item's
 * `createdAt` of the previous page). Items are unified across the two tables
 * and sorted oldest-first, so paging walks the queue in review order.
 */
export async function listMediaQueue(limit = 40, cursor?: string | null): Promise<MediaQueue> {
  const take = Math.min(120, Math.max(1, limit));
  const since = cursor ? new Date(cursor) : null;
  const whenFilter = since ? { gt: since } : undefined;
  const [avatars, gigCovers] = await Promise.all([
    prisma.user.findMany({
      where: { avatarUrl: { not: null }, createdAt: whenFilter },
      orderBy: { createdAt: 'asc' },
      take,
      select: { id: true, avatarUrl: true, fullName: true, username: true, role: true, createdAt: true },
    }),
    prisma.gig.findMany({
      where: { coverImageUrl: { not: null }, createdAt: whenFilter },
      orderBy: { createdAt: 'asc' },
      take,
      select: {
        id: true,
        slug: true,
        coverImageUrl: true,
        title: true,
        createdAt: true,
        owner: { select: { id: true, fullName: true, username: true, role: true } },
      },
    }),
  ]);
  const [avatars, gigCovers] = await Promise.all([
    prisma.user.findMany({
      where: { avatarUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, avatarUrl: true, fullName: true, username: true, role: true, createdAt: true },
    }),
    prisma.gig.findMany({
      where: { coverImageUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        slug: true,
        coverImageUrl: true,
        title: true,
        createdAt: true,
        owner: { select: { id: true, fullName: true, username: true, role: true } },
      },
    }),
  ]);

  const items: MediaItem[] = [
    ...avatars.map((u) => ({
      kind: 'avatar' as const,
      refId: u.id,
      url: u.avatarUrl!,
      ownerName: u.fullName,
      ownerUsername: u.username,
      ownerRole: u.role as UserRole,
      createdAt: u.createdAt,
    })),
    ...gigCovers.map((g) => ({
      kind: 'gigCover' as const,
      refId: g.id,
      url: g.coverImageUrl!,
      ownerName: g.owner.fullName,
      ownerUsername: g.owner.username,
      ownerRole: g.owner.role as UserRole,
      title: g.title,
      gigId: g.id,
      createdAt: g.createdAt,
    })),
  ];

  // Oldest first so the oldest items sit on top and get reviewed first.
  items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const page = items.slice(0, limit);
  const nextCursor = items.length > limit ? page[page.length - 1]?.createdAt.toISOString() ?? null : null;
  return { total: items.length, items: page, nextCursor };
}

/** Remove a user's profile photo (admin action on a flagged/unsafe avatar). */
export async function removeAvatar(userId: string): Promise<{ ok: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
  return { ok: true };
}

/** Flag a gig as needing review (its cover / content is unsafe). */
export async function flagGig(gigId: string): Promise<{ ok: boolean }> {
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig) throw new NotFoundError('Gig');
  await prisma.gig.update({
    where: { id: gigId },
    data: { isFlagged: true, flaggedReason: 'Media flagged by admin' },
  });
  return { ok: true };
}
