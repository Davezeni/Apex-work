import { z } from 'zod';

/** Per-account notification categories. These control durable in-app alerts. */
export const notificationPreferencesSchema = z.object({
  messages: z.boolean().default(true),
  orders: z.boolean().default(true),
  reviews: z.boolean().default(true),
  payments: z.boolean().default(true),
  promotions: z.boolean().default(false),
  system: z.boolean().default(true),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: true,
  orders: true,
  reviews: true,
  payments: true,
  promotions: false,
  system: true,
};
