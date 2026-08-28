import { z } from 'zod';
import { phoneSchema } from './auth.js';

export const oauthProviderSchema = z.enum(['google', 'github']);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

export const oauthStartSchema = z.object({
  provider: oauthProviderSchema,
  role: z.enum(['CLIENT', 'FREELANCER']).default('CLIENT'),
  next: z.string().max(240).optional(),
});
export type OAuthStartInput = z.infer<typeof oauthStartSchema>;

export const oauthHandoffSchema = z.object({
  handoff: z.string().min(20).max(120),
});
export type OAuthHandoffInput = z.infer<typeof oauthHandoffSchema>;

/** Complete an OAuth signup after the user verifies their Ethiopian phone. */
export const completeOAuthSignupSchema = z.object({
  oauthToken: z.string().min(20).max(120),
  phone: phoneSchema,
  otpToken: z.string().min(1).max(200),
  fullName: z.string().trim().min(2).max(80),
  role: z.enum(['CLIENT', 'FREELANCER']).default('CLIENT'),
});
export type CompleteOAuthSignupInput = z.infer<typeof completeOAuthSignupSchema>;
