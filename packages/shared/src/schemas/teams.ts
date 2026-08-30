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

export const inviteAgencyMemberSchema = z.object({
  username: z.string().trim().min(2).max(60),
  role: z.enum(['MEMBER', 'MANAGER']).default('MEMBER'),
});
export type InviteAgencyMemberInput = z.infer<typeof inviteAgencyMemberSchema>;
