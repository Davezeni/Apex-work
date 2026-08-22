import { z } from 'zod';

/** Milestone create/update. Server enforces sum(amountEtb) === order.amountEtb. */
export const milestoneInputSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(2000).nullable().optional(),
  amountEtb: z.number().int().min(0).max(1_000_000),
  dueDate: z.string().datetime().nullable().optional(),
});
export type MilestoneInput = z.infer<typeof milestoneInputSchema>;

export const bulkMilestonesSchema = z.object({
  milestones: z.array(milestoneInputSchema).min(1).max(20),
});
export type BulkMilestonesInput = z.infer<typeof bulkMilestonesSchema>;
