import { z } from 'zod';

/** Track a referral-link click (public; no auth required). */
export const trackReferralClickSchema = z.object({
  refCode: z.string().trim().min(1).max(60),
  source: z.string().trim().min(1).max(40).default('link'),
});
export type TrackReferralClickInput = z.infer<typeof trackReferralClickSchema>;
