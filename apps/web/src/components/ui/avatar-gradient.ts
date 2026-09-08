/**
 * Central, REVISED avatar fallback palette.
 *
 * Replaces the old high-saturation rainbow set (violet→emerald, amber→red,
 * cyan→violet…) which read as generic AI/vibe-coder art. These are muted,
 * desaturated jewel/slate tones that coordinate with the single violet brand
 * so every avatar looks intentional and premium rather than random.
 */
export const AVATAR_GRADIENTS = [
  'from-violet-600 to-indigo-600',
  'from-indigo-600 to-slate-600',
  'from-purple-600 to-violet-600',
  'from-slate-600 to-slate-700',
  'from-blue-700 to-indigo-600',
  'from-teal-700 to-slate-700',
] as const;

/** Deterministic muted gradient for a seed string (avatar fallback). */
export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]!;
}
