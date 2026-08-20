import { z } from 'zod';
import { CATEGORIES, MAX_GIG_PRICE_ETB, MIN_GIG_PRICE_ETB } from '../constants';

const categoryIds = CATEGORIES.map((c) => c.id) as [string, ...string[]];

export const createGigSchema = z.object({
  title: z.string().trim().min(15, 'Title must be at least 15 characters').max(120),
  categoryId: z.enum(categoryIds),
  tags: z.array(z.string().trim().max(30)).max(8).default([]),
  description: z.string().trim().min(50).max(5000),
  packages: z
    .array(
      z.object({
        tier: z.enum(['BASIC', 'STANDARD', 'PREMIUM']),
        title: z.string().trim().max(60),
        description: z.string().trim().max(500),
        priceEtb: z.number().int().min(MIN_GIG_PRICE_ETB).max(MAX_GIG_PRICE_ETB),
        deliveryDays: z.number().int().min(1).max(90),
        revisions: z.number().int().min(0).max(20),
      }),
    )
    .min(1)
    .max(3),
  coverImageUrl: z.string().url().optional(),
  galleryUrls: z.array(z.string().url()).max(5).default([]),
});
export type CreateGigInput = z.infer<typeof createGigSchema>;

export const gigListQuerySchema = z.object({
  category: z.enum(categoryIds).optional(),
  q: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['recent', 'rating', 'price_asc', 'price_desc']).default('recent'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type GigListQuery = z.infer<typeof gigListQuerySchema>;
