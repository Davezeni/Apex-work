import { z } from 'zod';
import { ETHIOPIAN_PHONE_REGEX, OTP_LENGTH, USER_ROLES } from '../constants/index.js';

/** Ethiopian mobile phone: +2519XXXXXXXX / +2517XXXXXXXX */
export const phoneSchema = z
  .string()
  .trim()
  .regex(ETHIOPIAN_PHONE_REGEX, 'Enter a valid Ethiopian mobile number (+2519… or +2517…)');

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

/** Request OTP for phone login/signup */
export const requestOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['SIGNUP', 'LOGIN', 'RESET']).default('LOGIN'),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

/** Verify OTP */
export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .length(OTP_LENGTH, `Code must be ${OTP_LENGTH} digits`)
    .regex(/^\d+$/, 'Code must contain only digits'),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/** Signup with phone (after OTP verify) */
export const signupSchema = z.object({
  phone: phoneSchema,
  otpToken: z.string().min(1), // temp token from verifyOtp
  fullName: z.string().trim().min(2).max(80),
  role: z.enum(USER_ROLES).default('CLIENT'),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  referralCode: z.string().trim().max(20).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

/** Login with email + password (alternative to OTP) */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Refresh token */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

/** Auth response */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
