/**
 * Money helpers — single source of truth for platform economics.
 *
 * All amounts are integer ETB (minor-free), so joins and splits never drift.
 * Platform fee is rounded to the nearest whole ETB, and the seller always
 * receives exactly `gross - fee` so the books reconcile perfectly.
 */
import { PLATFORM_FEE_PERCENT } from '../constants/index.js';

export interface OrderSplit {
  /** What the client pays. */
  grossEtb: number;
  /** Platform commission retained. */
  feeEtb: number;
  /** What the seller receives (always gross - fee). */
  sellerNetEtb: number;
}

/**
 * Compute the fee/seller split for a gross amount.
 * Rounding: fee rounds to nearest ETB; sellerNet = gross - fee (never drifts).
 */
export function computeOrderSplit(grossEtb: number, feePercent: number = PLATFORM_FEE_PERCENT): OrderSplit {
  const feeEtb = Math.round((grossEtb * feePercent) / 100);
  return { grossEtb, feeEtb, sellerNetEtb: grossEtb - feeEtb };
}

/** Clamp/validate a positive gross amount within platform bounds. */
export function isValidGigPrice(grossEtb: number, min = 100, max = 500_000): boolean {
  return Number.isInteger(grossEtb) && grossEtb >= min && grossEtb <= max;
}
