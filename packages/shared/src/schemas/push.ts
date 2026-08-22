import { z } from 'zod';

/**
 * Web Push subscription payload, matching the shape returned by the
 * browser's `PushSubscription.toJSON()` API. We store one row per unique
 * endpoint so users can be subscribed on multiple devices.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(600),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
  userAgent: z.string().max(500).optional(),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
