import { Router } from 'express';
import { createReviewSchema, createReviewReplySchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import * as reviews from '../services/reviews.service.js';
import { cache, bust } from '../middleware/cache.js';

const router: Router = Router();

/** POST /reviews — write a review for a completed order. */
router.post(
  '/',
  requireAuth,
  validate(createReviewSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateReviewInput;
    const review = await reviews.createReview({
      authorId: req.user!.sub,
      orderId: body.orderId,
      rating: body.rating,
      comment: body.comment,
      photoUrls: body.photoUrls,
    });
    void bust('/v1/reviews');
    void bust('/v1/users');
    return success(res, review, 201);
  }),
);

/** GET /reviews?userId= — public list of reviews about a user. */
router.get(
  '/',
  optionalAuth,
  cache({ ttlSeconds: 120, swrAfterSeconds: 40 }),
  asyncHandler(async (req, res) => {
    const q = req.query as { userId?: string; cursor?: string; limit?: string };
    if (!q.userId) throw new NotFoundError('User');
    const limit = Math.min(Math.max(Number(q.limit ?? 20), 1), 50);
    const result = await reviews.listReviewsFor(q.userId, { limit, cursor: q.cursor });
    return success(res, result);
  }),
);

/**
 * PUT /reviews/:id/reply — the seller (subject of the review) posts or edits
 * their rebuttal. Idempotent — calling again edits the reply.
 */
router.put(
  '/:id/reply',
  requireAuth,
  validate(createReviewReplySchema.pick({ comment: true })),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { comment } = req.body as { comment: string };
    const result = await reviews.upsertReviewReply({
      reviewId: id,
      subjectId: req.user!.sub,
      comment,
    });
    void bust(`/v1/reviews`);
    return success(res, result, result.created ? 201 : 200);
  }),
);

/** DELETE /reviews/:id/reply — the seller removes their rebuttal. */
router.delete(
  '/:id/reply',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const result = await reviews.deleteReviewReply(id, req.user!.sub);
    void bust(`/v1/reviews`);
    return success(res, result);
  }),
);

/** GET /reviews/for-order/:orderId — my own review for a specific order (if any). */
router.get(
  '/for-order/:orderId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params as { orderId: string };
    // Confirm the caller is the client on that order (order.get would also enforce this,
    // but we surface a plain 200/null shape so the frontend can toggle a "Rate" CTA).
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true },
    });
    if (!order || order.clientId !== req.user!.sub) throw new NotFoundError('Order');
    const review = await reviews.getMyReviewForOrder(orderId, req.user!.sub);
    return success(res, { review });
  }),
);

export default router;
