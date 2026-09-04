import { z } from 'zod';

export const createReviewSchema = z.object({
  orderId: z.string().min(1).max(40),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  /** Optional review photos (Supabase URLs, max 4). */
  photoUrls: z.array(z.string().url().max(1000)).max(4).default([]),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/** A seller's rebuttal to a review written about them. */
export const createReviewReplySchema = z.object({
  reviewId: z.string().min(1).max(40),
  comment: z.string().trim().min(1).max(2000),
});
export type CreateReviewReplyInput = z.infer<typeof createReviewReplySchema>;
