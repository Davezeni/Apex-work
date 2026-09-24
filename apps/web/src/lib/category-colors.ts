/**
 * The color that best "describes" each skill category — used by the hero
 * floating labels and any category chip that wants per-category identity.
 * Inline hex (not Tailwind classes) so dynamic values survive JIT.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  development: '#0284C7', // tech blue
  design: '#7C3AED', // creative violet
  writing: '#2563EB', // ink blue
  video: '#E11D48', // recording rose
  marketing: '#EA580C', // megaphone orange
  audio: '#DB2777', // stage pink
  data: '#0891B2', // analytic cyan
  business: '#D97706', // briefcase amber
};
