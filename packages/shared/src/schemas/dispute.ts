import { z } from 'zod';

export const openDisputeSchema = z.object({
  orderId: z.string().min(1).max(40),
  reason: z.string().trim().min(20, 'Explain the issue (20+ chars)').max(4000),
});
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;

/**
 * Admin ruling. RESOLVED_SPLIT requires both amounts and they must sum
 * to the order total (server enforces).
 */
export const resolveDisputeSchema = z
  .object({
    ruling: z.enum(['RESOLVED_CLIENT', 'RESOLVED_SELLER', 'RESOLVED_SPLIT', 'WITHDRAWN']),
    clientPayoutEtb: z.number().int().min(0).max(1_000_000).optional(),
    sellerPayoutEtb: z.number().int().min(0).max(1_000_000).optional(),
    adminNotes: z.string().trim().max(4000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.ruling === 'RESOLVED_SPLIT') {
      if (v.clientPayoutEtb == null || v.sellerPayoutEtb == null) {
        ctx.addIssue({ code: 'custom', path: ['clientPayoutEtb'], message: 'Both payouts required for a split' });
      }
    }
  });
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
