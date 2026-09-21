import { z } from 'zod';

export const proPlanSchema = z.enum(['FREELANCER_PRO', 'CLIENT_PRO']);
export type ProPlanInput = z.infer<typeof proPlanSchema>;

export const subscriptionCheckoutSchema = z.object({ plan: proPlanSchema });
export type SubscriptionCheckoutInput = z.infer<typeof subscriptionCheckoutSchema>;

export const subscriptionVerifySchema = z.object({ purchaseId: z.string().trim().min(10).max(80) });
export type SubscriptionVerifyInput = z.infer<typeof subscriptionVerifySchema>;

export const createAgencySchema = z.object({
  name: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(1600).optional(),
  website: z.string().trim().url().max(300).optional(),
  logoUrl: z.string().trim().url().max(500).optional(),
});
export type CreateAgencyInput = z.infer<typeof createAgencySchema>;

export const agencyUpdateSchema = z.object({
  defaultAssigneeSharePct: z.number().int().min(0).max(100).optional(),
  bio: z.string().trim().max(1600).nullable().optional(),
  website: z.string().trim().url().max(300).nullable().optional(),
  logoUrl: z.string().trim().url().max(500).nullable().optional(),
});
export type AgencyUpdateInput = z.infer<typeof agencyUpdateSchema>;

export const agencyProjectSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1200).optional(),
  url: z.string().trim().url().max(300).optional(),
  imageUrl: z.string().trim().url().max(500).optional(),
});
export type AgencyProjectInput = z.infer<typeof agencyProjectSchema>;

export const agencyMemberRoleSchema = z.object({
  role: z.enum(['MEMBER', 'MANAGER']),
});
export type AgencyMemberRoleInput = z.infer<typeof agencyMemberRoleSchema>;

/** A client inviting a team to bid on their job. */
export const jobAgencyInviteSchema = z.object({
  agencyId: z.string().trim().min(10).max(64),
  message: z.string().trim().max(600).optional(),
});
export type JobAgencyInviteInput = z.infer<typeof jobAgencyInviteSchema>;

export const assignOrderSchema = z.object({
  userId: z.string().trim().min(10).nullable(),
  sharePct: z.number().int().min(0).max(100).optional(),
});
export type AssignOrderInput = z.infer<typeof assignOrderSchema>;

export const inviteAgencyMemberSchema = z.object({
  username: z.string().trim().min(2).max(60),
  role: z.enum(['MEMBER', 'MANAGER']).default('MEMBER'),
});
export type InviteAgencyMemberInput = z.infer<typeof inviteAgencyMemberSchema>;
