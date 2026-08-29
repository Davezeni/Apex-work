import { z } from 'zod';

/** Freelancer onboarding — captures profile setup after signup. */
export const freelancerOnboardingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(120, 'Title must be under 120 characters'),
  bio: z
    .string()
    .trim()
    .min(30, 'Tell clients more about yourself — at least 30 characters')
    .max(2000),
  city: z.string().trim().min(2).max(80),
  hourlyRateEtb: z
    .number()
    .int('Hourly rate must be a whole number')
    .min(50, 'Minimum hourly rate is 50 ETB')
    .max(10_000, 'Maximum hourly rate is 10,000 ETB'),
  skillIds: z
    .array(z.string().min(1))
    .min(1, 'Pick at least one skill')
    .max(40, 'You can select up to 40 skills'),
});
export type FreelancerOnboardingInput = z.infer<typeof freelancerOnboardingSchema>;

/** Client onboarding — light-touch: name is already collected at signup, we just mark them onboarded. */
export const clientOnboardingSchema = z.object({
  interests: z.array(z.string().min(1)).max(8).default([]),
});
export type ClientOnboardingInput = z.infer<typeof clientOnboardingSchema>;
