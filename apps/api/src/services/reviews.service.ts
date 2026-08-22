/**
 * Reviews.
 *
 * A review is a tuple: {order, author, subject, rating, comment}. Written
 * once per (order, author) pair (unique constraint enforces this at the DB
 * level). Rating rolls up onto User.rating + User.ratingCount via a small
 * batch computed inside the same transaction — cheaper than triggers and
 * plays nice with Prisma.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import { notify } from './notifications.service.js';

export async function createReview(input: {
  authorId: string;
  orderId: string;
  rating: number;
  comment?: string;
}) {
  if (input.rating < 1 || input.rating > 5) {
    throw new BadRequestError('Rating must be between 1 and 5');
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, clientId: true, sellerId: true, status: true, title: true },
  });
  if (!order) throw new NotFoundError('Order');
  if (order.status !== 'COMPLETED') {
    throw new ConflictError('You can only review a completed order');
  }
  // Only the client rates the seller (marketplace default). If we later add
  // seller-rates-client, drop this check + branch subject/author.
  if (order.clientId !== input.authorId) throw new ForbiddenError();

  const subjectId = order.sellerId;

  const review = await prisma.$transaction(async (tx) => {
    // Fail with a friendly error rather than a raw Prisma unique-violation.
    const existing = await tx.review.findFirst({
      where: { orderId: order.id, authorId: input.authorId },
      select: { id: true },
    });
    if (existing) throw new ConflictError('You already reviewed this order');

    const r = await tx.review.create({
      data: {
        orderId: order.id,
        authorId: input.authorId,
        subjectId,
        rating: input.rating,
        comment: input.comment ?? null,
      },
    });

    // Recompute aggregate. We don't chase denormalisation edge cases —
    // one small SELECT + one UPDATE keeps rating exact and self-healing.
    const agg = await tx.review.aggregate({
      where: { subjectId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.user.update({
      where: { id: subjectId },
      data: {
        rating: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });
    return r;
  });

  await notify({
    userId: subjectId,
    type: 'REVIEW',
    title: `New ${input.rating}★ review`,
    body: `On order: ${order.title}`,
    payload: { orderId: order.id, reviewId: review.id },
  });

  return review;
}

/** Fetch reviews written about a user (their public rep). */
export async function listReviewsFor(subjectId: string, opts: { limit: number; cursor?: string }) {
  const items = await prisma.review.findMany({
    where: { subjectId },
    orderBy: { createdAt: 'desc' },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      author: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      order: { select: { id: true, title: true } },
    },
  });
  const hasMore = items.length > opts.limit;
  const trimmed = hasMore ? items.slice(0, opts.limit) : items;
  return {
    items: trimmed,
    nextCursor: hasMore ? (trimmed[trimmed.length - 1]?.id ?? null) : null,
    hasMore,
  };
}

export async function getMyReviewForOrder(orderId: string, authorId: string) {
  return prisma.review.findFirst({
    where: { orderId, authorId },
    select: { id: true, rating: true, comment: true, createdAt: true },
  });
}
