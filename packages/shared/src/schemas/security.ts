import { z } from 'zod';
import { phoneSchema } from './auth.js';

/** 6-digit numeric PIN. Client-side format validation only — server also hashes. */
export const pinSchema = z
  .string()
  .length(6, 'PIN must be exactly 6 digits')
  .regex(/^\d{6}$/, 'PIN must contain only digits');

/**
 * Reject the 20 most common PINs to nudge users toward stronger choices.
 * Not a hard security control — attacks are rate-limited server-side — just a
 * gentle push to avoid trivial guesses.
 */
const WEAK_PINS = new Set([
  '000000', '111111', '222222', '333333', '444444', '555555',
  '666666', '777777', '888888', '999999',
  '123456', '654321', '012345', '098765',
  '123123', '456456', '112233', '121212', '696969', '420420',
]);

export const setPinSchema = z.object({
  pin: pinSchema.refine((v) => !WEAK_PINS.has(v), {
    message: 'That PIN is too common. Please choose a less predictable one.',
  }),
});
export type SetPinInput = z.infer<typeof setPinSchema>;

export const verifyPinSchema = z.object({
  pin: pinSchema,
  /** Client sends its device token so we can auto-refresh the session on success. */
  deviceToken: z.string().min(20).max(200).optional(),
});
export type VerifyPinInput = z.infer<typeof verifyPinSchema>;

/**
 * PIN-based login: phone + PIN + trusted-device token (all three required).
 * Never accept phone+PIN alone — that would let attackers try random phones.
 */
export const loginWithPinSchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
  deviceToken: z.string().min(20).max(200),
});
export type LoginWithPinInput = z.infer<typeof loginWithPinSchema>;

/** Client sends this at OTP request time so the server knows "check if device is trusted first". */
export const trustedDeviceSchema = z
  .object({
    deviceToken: z.string().min(20).max(200).optional(),
  })
  .default({});
