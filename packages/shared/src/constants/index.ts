/**
 * Application-wide constants.
 * Keep in sync with Prisma enums where relevant.
 */

export const APP_NAME = 'Apex-Work' as const;
export const APP_TAGLINE = "Ethiopia's most powerful freelance marketplace" as const;

/** Supported UI languages (BCP-47) */
export const LOCALES = ['en', 'am', 'om'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  am: 'አማርኛ',
  om: 'Afaan Oromoo',
};

/** User roles */
export const USER_ROLES = ['CLIENT', 'FREELANCER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Currencies */
export const CURRENCIES = ['ETB', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'ETB';

/** Order status lifecycle */
export const ORDER_STATUSES = [
  'PENDING',
  'ACTIVE',
  'IN_REVIEW',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Digital skill categories (Ethiopia-focused) */
export const CATEGORIES = [
  { id: 'development', label: 'Development', icon: '💻', slug: 'development' },
  { id: 'design', label: 'Design', icon: '🎨', slug: 'design' },
  { id: 'writing', label: 'Writing & Translation', icon: '✍️', slug: 'writing' },
  { id: 'video', label: 'Video & Animation', icon: '🎬', slug: 'video' },
  { id: 'marketing', label: 'Digital Marketing', icon: '📱', slug: 'marketing' },
  { id: 'audio', label: 'Music & Audio', icon: '🎤', slug: 'audio' },
  { id: 'data', label: 'Data & AI', icon: '📊', slug: 'data' },
  { id: 'business', label: 'Business & Admin', icon: '💼', slug: 'business' },
] as const;

/** Ethiopian payment methods (via Chapa) */
export const PAYMENT_METHODS = [
  { id: 'telebirr', label: 'Telebirr', icon: '📱' },
  { id: 'cbebirr', label: 'CBE Birr', icon: '🏦' },
  { id: 'ebirr', label: 'E-Birr', icon: '💵' },
  { id: 'hellocash', label: 'HelloCash', icon: '💰' },
  { id: 'mpesa', label: 'M-Pesa ET', icon: '📡' },
  { id: 'card', label: 'Visa / Mastercard', icon: '💳' },
  { id: 'bank', label: 'Bank Transfer', icon: '🏦' },
] as const;

/** Platform economics */
export const PLATFORM_FEE_PERCENT = 10; // Lower than Fiverr's 20%
export const MIN_WITHDRAWAL_ETB = 100;
export const MIN_GIG_PRICE_ETB = 100;
export const MAX_GIG_PRICE_ETB = 500_000;

/** Rate limits */
export const RATE_LIMITS = {
  auth: { window: 15 * 60 * 1000, max: 20 }, // 20 attempts / 15 min
  otp: { window: 60 * 60 * 1000, max: 15 }, // 15 OTPs / hour (raised from 5 for beta testing)
  api: { window: 15 * 60 * 1000, max: 300 }, // general API
  messages: { window: 60 * 1000, max: 60 }, // 60 msgs / min
} as const;

/** File upload limits */
export const UPLOAD_LIMITS = {
  avatar: { maxBytes: 5 * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  portfolio: {
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
  },
  chatFile: {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'audio/mpeg',
      'audio/webm',
      'video/mp4',
    ],
  },
} as const;

/** Regex — Ethiopian phone: +2519XXXXXXXX or +2517XXXXXXXX (mobile) */
export const ETHIOPIAN_PHONE_REGEX = /^\+251[79]\d{8}$/;

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
