/**
 * Admin operations schemas — inputs for the admin-panel control surface.
 * Validation is the single source of truth shared with the web admin UI.
 */
import { z } from 'zod';

// ---------------- Content moderation ----------------

export const gigModerateSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  isFlagged: z.boolean().optional(),
  flaggedReason: z.string().max(1000).optional(),
  setFeaturedUntil: z.string().datetime().nullable().optional(),
  pin: z.boolean().optional(),
});

export const jobModerateSchema = z.object({
  isOpen: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export const reviewModerateSchema = z.object({
  action: z.enum(['HIDE', 'RESTORE']),
  reason: z.string().max(1000).optional(),
});

// ---------------- Money ----------------

export const orderRefundSchema = z.object({
  amountEtb: z.number().int().min(1),
  reason: z.string().min(3).max(500),
});

export const walletAdjustSchema = z.object({
  type: z.enum(['MANUAL_CREDIT', 'MANUAL_DEBIT', 'REFERRAL_BONUS']),
  amountEtb: z.number().int().min(1),
  description: z.string().min(3).max(500),
});

export const feeConfigSchema = z.object({
  platformFeePercent: z.number().min(0).max(50),
});

// ---------------- Promotion / broadcast ----------------

export const featuredSchema = z.object({
  days: z.number().int().min(1).max(365).default(7),
});

export const broadcastSchema = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(3).max(2000),
  // 'all' pushes to everyone; 'freelancers' | 'clients' scopes by role.
  scope: z.enum(['all', 'freelancers', 'clients']).default('all'),
  sendPush: z.boolean().default(true),
});

// ---------------- Users / RBAC ----------------

export const userRoleSchema = z.object({
  role: z.enum(['CLIENT', 'FREELANCER', 'ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE']),
});

// ---------------- Support ----------------

export const ticketReplySchema = z.object({
  body: z.string().min(1).max(5000),
});

export const ticketStatusSchema = z.object({
  status: z.enum(['OPEN', 'WAITING_USER', 'WAITING_STAFF', 'RESOLVED', 'CLOSED']),
});

// ---------------- Settings ----------------

export const settingUpsertSchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9_.-]{1,80}$/),
  value: z.unknown(),
  description: z.string().max(300).optional(),
});
