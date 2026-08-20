import { z } from 'zod';
import { USER_ROLES } from '../constants';

export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(USER_ROLES),
  isVerified: z.boolean(),
  city: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const meSchema = publicUserSchema.extend({
  email: z.string().email().nullable(),
  phone: z.string(),
  bio: z.string().nullable(),
  hourlyRateEtb: z.number().nullable(),
  isOnboarded: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(80).optional(),
  hourlyRateEtb: z.number().int().min(0).max(1_000_000).optional(),
  title: z.string().trim().max(120).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
