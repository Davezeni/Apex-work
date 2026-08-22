import { z } from 'zod';

export const createSavedSearchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(['GIGS', 'JOBS', 'USERS']),
  query: z.string().trim().min(1).max(200),
  category: z.string().trim().max(40).optional(),
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
});
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;

export const updateSavedSearchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
