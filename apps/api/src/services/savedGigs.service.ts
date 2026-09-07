import { prisma } from '../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

const gigSelect = {
  id: true,
  slug: true,
  title: true,
  coverImageUrl: true,
  categoryId: true,
  status: true,
  rating: true,
  ratingCount: true,
  startingPriceEtb: true,
  owner: {
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      city: true,
      isPhoneVerified: true,
      isIdVerified: true,
    },
  },
} as const;

async function findActiveGig(slug: string) {
  const gig = await prisma.gig.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true },
  });
  if (!gig || gig.status !== 'ACTIVE') throw new NotFoundError('Gig');
  return gig;
}

/** Return saved gigs newest first. Archived gigs stay visible so a saved item never disappears silently. */
export async function listMine(userId: string) {
  return prisma.savedGig.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      gig: { select: gigSelect },
    },
  });
}

export async function status(userId: string, slug: string) {
  const gig = await prisma.gig.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!gig) throw new NotFoundError('Gig');
  const row = await prisma.savedGig.findUnique({
    where: { userId_gigId: { userId, gigId: gig.id } },
    select: { id: true },
  });
  return { saved: !!row };
}

/** Idempotent save: repeated taps do not create duplicates. */
export async function save(userId: string, slug: string) {
  const gig = await findActiveGig(slug);
  const row = await prisma.savedGig.upsert({
    where: { userId_gigId: { userId, gigId: gig.id } },
    create: { userId, gigId: gig.id },
    update: {},
    select: { id: true, createdAt: true },
  });
  return { saved: true, id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function remove(userId: string, slug: string) {
  const gig = await prisma.gig.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!gig) throw new NotFoundError('Gig');
  await prisma.savedGig.deleteMany({ where: { userId, gigId: gig.id } });
  return { saved: false };
}

/**
 * Defensive ownership check used by future admin/reporting extensions. Kept
 * here so saved-gig authorization rules stay in one service boundary.
 */
export async function assertOwner(userId: string, savedGigId: string) {
  const row = await prisma.savedGig.findUnique({
    where: { id: savedGigId },
    select: { userId: true },
  });
  if (!row) throw new NotFoundError('Saved gig');
  if (row.userId !== userId) throw new ForbiddenError();
  return row;
}
