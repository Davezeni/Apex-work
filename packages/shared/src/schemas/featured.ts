import { z } from 'zod';

/** Boost tiers — freelancer pays this ETB amount from their wallet to
 * pin their gig at the top of its category for `days` days. */
export const BOOST_TIERS = [
  { days: 3,  priceEtb: 150,  label: '3 days' },
  { days: 7,  priceEtb: 300,  label: '1 week' },
  { days: 30, priceEtb: 900,  label: '1 month' },
] as const;
export type BoostTier = (typeof BOOST_TIERS)[number];

export const boostGigSchema = z.object({
  days: z.number().int().refine((d) => BOOST_TIERS.some((t) => t.days === d), 'Invalid tier'),
});
export type BoostGigInput = z.infer<typeof boostGigSchema>;
