import { z } from 'zod';
import { LOCALES } from '../constants/index.js';

/**
 * One-tap chat message translation. The API proxies to a free translation
 * provider (MyMemory) with caching + per-user rate limits, so the client
 * never talks to it directly.
 */
export const translateSchema = z.object({
  /** Message text to translate (clamped server-side to 1200 chars). */
  text: z.string().trim().min(1).max(1200),
  /** Source language; omit to auto-detect by script (Ethiopic → am, Latin → en). */
  source: z.enum(LOCALES).optional(),
  /** Target UI language. */
  target: z.enum(LOCALES),
});
export type TranslateInput = z.infer<typeof translateSchema>;

export interface TranslateResult {
  translated: string;
  source: string;
  target: string;
  cached: boolean;
}
