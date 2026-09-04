/**
 * Marketplace categories + per-category fee overrides.
 *
 * Each category is a first-class row (slug = id) that can carry its own
 * `feePercent`. When set, orders in that category use it; when NULL they
 * inherit the global `platform.feePercent`. This lets admins run, e.g., a
 * lower rate for high-volume categories or a premium rate for high-touch
 * ones without touching the global setting.
 */
import { prisma } from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { getPlatformFeePercent } from './admin/settings.service.js';

export async function listCategories() {
  const rows = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { updatedBy: { select: { fullName: true, username: true } } },
  });
  const globalFeePercent = await getPlatformFeePercent();
  return rows.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    feePercent: c.feePercent,
    effectiveFeePercent: c.feePercent ?? globalFeePercent,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    updatedAt: c.updatedAt,
    updatedByName: c.updatedBy ? `${c.updatedBy.fullName} (@${c.updatedBy.username})` : null,
  }));
}

export async function updateCategory(
  categoryId: string,
  update: { feePercent?: number | null; label?: string; icon?: string; isActive?: boolean; sortOrder?: number },
  updatedById: string,
) {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) throw new NotFoundError('Category');
  if (update.feePercent !== undefined && update.feePercent !== null) {
    if (!Number.isInteger(update.feePercent) || update.feePercent < 0 || update.feePercent > 50) {
      throw new BadRequestError('Fee percent must be an integer between 0 and 50');
    }
    if (update.label && update.label.trim().length === 0) {
      throw new BadRequestError('Label cannot be empty');
    }
  }
  return prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(update.feePercent !== undefined ? { feePercent: update.feePercent } : {}),
      ...(update.label ? { label: update.label.trim() } : {}),
      ...(update.icon ? { icon: update.icon } : {}),
      ...(update.isActive !== undefined ? { isActive: update.isActive } : {}),
      ...(update.sortOrder !== undefined ? { sortOrder: update.sortOrder } : {}),
      updatedById,
    },
  });
}

/** Clear the per-category override so it inherits the global fee. */
export async function resetCategoryFee(categoryId: string, updatedById: string) {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) throw new NotFoundError('Category');
  return prisma.category.update({
    where: { id: categoryId },
    data: { feePercent: null, updatedById },
  });
}

/**
 * Effective fee percent for a category slug. Honors a per-category override;
 * otherwise falls back to the global `platform.feePercent`. Returns the global
 * rate for unknown/missing categories so order creation never breaks.
 */
export async function getCategoryFeePercent(categoryId: string | null | undefined): Promise<number> {
  const globalFeePercent = await getPlatformFeePercent();
  if (!categoryId) return globalFeePercent;
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { feePercent: true, isActive: true },
  });
  if (cat && cat.isActive && cat.feePercent !== null) return cat.feePercent;
  return globalFeePercent;
}
