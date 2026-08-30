/**
 * Settings service — typed key/value store (AppSetting) for runtime-tunable
 * platform config: feature flags, platform fee, limits. Edited only by admins,
 * read once and cached by the app. Values are JSON typed per key.
 */
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';

export const SETTING_KEYS = {
  platformFeePercent: 'platform.feePercent',
  minWithdrawalEtb: 'limits.minWithdrawalEtb',
  maxUploadMb: 'limits.maxUploadMb',
  requirePhoneToPost: 'features.requirePhoneToPost',
  publicSignup: 'features.publicSignup',
  enablePayouts: 'features.enablePayouts',
  disableSignups: 'features.disableSignups',
} as const;

const plural = 'Unable to persist settings';

/** Setting definitions — key, zod validator, and a human description. */
const SETTING_DEFS: Record<string, { schema: z.ZodType; description: string }> = {
  [SETTING_KEYS.platformFeePercent]: {
    schema: z.number().min(0).max(50),
    description: 'Platform commission percent deducted from each order.',
  },
  [SETTING_KEYS.minWithdrawalEtb]: {
    schema: z.number().int().min(0),
    description: 'Minimum wallet balance to request a withdrawal (ETB).',
  },
  [SETTING_KEYS.maxUploadMb]: {
    schema: z.number().int().min(1).max(100),
    description: 'Maximum avatar/attachment upload size (MB).',
  },
  [SETTING_KEYS.requirePhoneToPost]: {
    schema: z.boolean(),
    description: 'Require a verified phone before posting gigs/jobs (high-trust gate).',
  },
  [SETTING_KEYS.publicSignup]: {
    schema: z.boolean(),
    description: 'Allow new public signups.',
  },
  [SETTING_KEYS.enablePayouts]: {
    schema: z.boolean(),
    description: 'Allow automated Chapa payouts (leave OFF until verified in sandbox).',
  },
  [SETTING_KEYS.disableSignups]: {
    schema: z.boolean(),
    description: 'Emergency switch — block all new signups.',
  },
};

export async function listSettings() {
  const rows = await prisma.appSetting.findMany({ orderBy: { key: 'asc' } });
  const all = Object.keys(SETTING_DEFS).map((key) => {
    const row = rows.find((r) => r.key === key);
    const def = SETTING_DEFS[key]!;
    return {
      key,
      description: def.description,
      // Fall back to a safe default when unset so the admin always sees a value.
      value: row ? row.value : undefined,
      updatedAt: row?.updatedAt ?? null,
      updatedByName: undefined as string | undefined,
      exists: !!row,
    };
  });
  // Resolve who last touched each setting.
  const ids = rows.map((r) => r.updatedById).filter(Boolean) as string[];
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, fullName: true, username: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const item of all) {
    const row = rows.find((r) => r.key === item.key);
    if (row?.updatedById) {
      const u = byId.get(row.updatedById);
      item.updatedByName = u ? `${u.fullName} (@${u.username})` : 'unknown';
    }
  }
  return all;
}

export async function getSetting<T>(key: string, fallback: T, schema?: z.ZodType<T>): Promise<T> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    if (!row) return fallback;
    if (schema) {
      const parsed = schema.safeParse(row.value);
      if (parsed.success) return parsed.data;
    }
    return row.value as T;
  } catch {
    return fallback;
  }
}

/** Current platform fee percent, honoring an overridden setting. */
export async function getPlatformFeePercent(): Promise<number> {
  return getSetting<number>(SETTING_KEYS.platformFeePercent, 10, z.number());
}

export async function upsertSetting(
  key: string,
  value: unknown,
  updatedById: string,
  description?: string,
) {
  const def = SETTING_DEFS[key];
  if (!def) throw new Error(`Unknown setting key: ${key}`);
  const parsed = def.schema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? plural);
  return prisma.appSetting.upsert({
    where: { key },
    update: { value: parsed.data, updatedById, ...(description ? { description } : {}) },
    create: { key, value: parsed.data, updatedById, description: description ?? def.description },
  });
}
