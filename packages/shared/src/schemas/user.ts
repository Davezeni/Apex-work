import { z } from 'zod';
import { USER_ROLES } from '../constants/index.js';

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
  phone: z.string().nullable(),
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
  avatarUrl: z.string().url().max(500).nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(160).nullable().optional(),
  /// Freelancer opts in to map discovery. Both set or both null.
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Weekly availability grid — 7 days × 9 two-hour slots (06-08, 08-10, …).
 * True = available. Kept as JSON on User.availabilityJson so we don't
 * need a row-per-slot table.
 */
export const availabilitySchema = z.object({
  hours: z.record(z.string().min(1).max(3), z.array(z.boolean()).length(9)),
  timezone: z.string().max(60).default('Africa/Addis_Ababa'),
  vacation: z.boolean().default(false),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
