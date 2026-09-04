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
  photoUrls?: string[];
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
        photoUrls: (input.photoUrls ?? []).slice(0, 4),
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
    select: {
      id: true,
      subjectId: true,
      rating: true,
      comment: true,
      photoUrls: true,
      createdAt: true,
      sellerReply: true,
      sellerRepliedAt: true,
      sellerReplyEditedAt: true,
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
    select: { id: true, rating: true, comment: true, photoUrls: true, createdAt: true },
  });
}

/**
 * Create or update a seller rebuttal to a review. The caller must be the
 * subject (seller) of the review. Idempotent: calling again edits the reply.
 * Returns `created: boolean` so the route can decide whether to re-notify.
 */
export async function upsertReviewReply(input: {
  reviewId: string;
  subjectId: string;
  comment: string;
}) {
  const review = await prisma.review.findUnique({
    where: { id: input.reviewId },
    select: {
      id: true,
      subjectId: true,
      authorId: true,
      orderId: true,
      sellerReply: true,
      sellerRepliedAt: true,
      order: { select: { title: true } },
    },
  });
  if (!review) throw new NotFoundError('Review');
  if (review.subjectId !== input.subjectId) throw new ForbiddenError();

  const wasNew = !review.sellerReply;

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: {
      sellerReply: input.comment,
      sellerRepliedAt: review.sellerRepliedAt ?? new Date(),
      sellerReplyEditedAt: wasNew ? null : new Date(),
    },
    select: { id: true, sellerReply: true, sellerRepliedAt: true, sellerReplyEditedAt: true },
  });

  // Notify the reviewer only the first time a reply is created.
  if (wasNew) {
    await notify({
      userId: review.authorId,
      type: 'REVIEW_REPLY',
      title: 'The seller replied to your review',
      body: `On order: ${review.order.title}`,
      payload: { reviewId: review.id, orderId: review.orderId },
    });
  }

  return { ...updated, created: wasNew };
}

/** Remove the seller's rebuttal. The seller must own the review they're replying to. */
export async function deleteReviewReply(reviewId: string, subjectId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, subjectId: true },
  });
  if (!review) throw new NotFoundError('Review');
  if (review.subjectId !== subjectId) throw new ForbiddenError();
  return prisma.review.update({
    where: { id: review.id },
    data: { sellerReply: null, sellerRepliedAt: null, sellerReplyEditedAt: null },
    select: { id: true, sellerReply: true, sellerRepliedAt: true, sellerReplyEditedAt: true },
  });
}
