import { z } from 'zod';

export const createOrderSchema = z.object({
  gigId: z.string().min(1).max(40),
  packageTier: z.enum(['BASIC', 'STANDARD', 'PREMIUM']),
  requirements: z.string().trim().max(3000).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Client-side action on an active order.
 * Server enforces role (client vs seller) and state transitions.
 */
export const orderActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('deliver'),
    notes: z.string().trim().max(2000).optional(),
    files: z.array(z.string().url().max(500)).max(10).optional(),
  }),
  z.object({ action: z.literal('accept') }),
  z.object({
    action: z.literal('revise'),
    notes: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal('cancel'),
    reason: z.string().trim().max(500).optional(),
  }),
]);
export type OrderActionInput = z.infer<typeof orderActionSchema>;
