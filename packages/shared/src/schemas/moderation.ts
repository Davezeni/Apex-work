import { z } from 'zod';

export const reportReasonSchema = z.enum([
  'SPAM',
  'HARASSMENT',
  'SCAM',
  'INAPPROPRIATE',
  'IMPERSONATION',
  'OTHER',
]);
export type ReportReason = z.infer<typeof reportReasonSchema>;

export const createReportSchema = z.object({
  targetType: z.enum(['USER', 'GIG', 'MESSAGE', 'CONVERSATION']),
  targetId: z.string().min(1).max(40),
  reason: reportReasonSchema,
  details: z.string().trim().max(2000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

/**
 * Send a custom offer inside a chat conversation. Buyer taps 'Accept' and
 * we create an Order + kick off Chapa checkout (same code path as normal
 * gig purchase).
 */
export const createOfferSchema = z.object({
  conversationId: z.string().min(1).max(40),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  priceEtb: z.number().int().min(100).max(500_000),
  deliveryDays: z.number().int().min(1).max(90),
  gigId: z.string().min(1).max(40).optional(),
});
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
