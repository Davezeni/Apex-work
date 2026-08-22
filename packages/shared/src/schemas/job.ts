import { z } from 'zod';
import { CATEGORIES, MAX_GIG_PRICE_ETB, MIN_GIG_PRICE_ETB } from '../constants/index.js';

const categoryIds = CATEGORIES.map((c) => c.id) as [string, ...string[]];

/**
 * Client-posted job (Upwork model). Optional budget bounds; freelancers bid.
 */
export const createJobSchema = z
  .object({
    title: z.string().trim().min(10).max(140),
    categoryId: z.enum(categoryIds),
    description: z.string().trim().min(30).max(6000),
    requiredSkills: z.array(z.string().trim().max(40)).max(15).default([]),
    budgetMinEtb: z.number().int().min(MIN_GIG_PRICE_ETB).max(MAX_GIG_PRICE_ETB).optional(),
    budgetMaxEtb: z.number().int().min(MIN_GIG_PRICE_ETB).max(MAX_GIG_PRICE_ETB).optional(),
    isRemote: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.budgetMinEtb && v.budgetMaxEtb && v.budgetMinEtb > v.budgetMaxEtb) {
      ctx.addIssue({
        code: 'custom',
        path: ['budgetMaxEtb'],
        message: 'Max budget must be at least the min',
      });
    }
  });
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const jobListQuerySchema = z.object({
  category: z.enum(categoryIds).optional(),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type JobListQuery = z.infer<typeof jobListQuerySchema>;

export const createBidSchema = z.object({
  message: z.string().trim().min(20, 'Explain your approach — at least 20 chars').max(3000),
  priceEtb: z.number().int().min(MIN_GIG_PRICE_ETB).max(MAX_GIG_PRICE_ETB),
  deliveryDays: z.number().int().min(1).max(90),
});
export type CreateBidInput = z.infer<typeof createBidSchema>;
