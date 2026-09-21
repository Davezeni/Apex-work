/**
 * Dynamic accent color (user-changeable theme color).
 *
 * The UI palette is CSS-variable driven: Tailwind maps `primary` to
 * `hsl(var(--primary))` where `--primary` holds an HSL *triplet*
 * ("262 83% 58%"). Setting the triplet (+ foreground + ring) as inline
 * variables on <html> overrides both the light and dark stylesheet blocks —
 * so one accent works in both modes, and `bg-primary/20` style opacity
 * modifiers keep working because the triplet format is preserved.
 *
 * Persisted in localStorage under `apex-accent` (hex). A tiny before-paint
 * script in the root layout re-applies it on load so there is no flash of
 * the default violet.
 */

export const ACCENT_STORAGE_KEY = 'apex-accent';

export interface AccentPreset {
  name: string;
  hex: string;
}

/** Curated presets — first entry is the app default (violet). */
export const ACCENT_PRESETS: AccentPreset[] = [
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Pink', hex: '#db2777' },
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0]?.hex ?? '#0d9488';

/** "#7c3aed" -> "262 83% 58%" (matches the globals.css triplet format). */
export function hexToHslTriplet(hex: string): string | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const int = parseInt(m[1] ?? '', 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Relative luminance 0..1 — picks a readable foreground for the accent. */
function luminance(hex: string): number {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return 0;
  const int = parseInt(m[1] ?? '', 16);
  const channel = (shift: number): number => {
    const raw = ((int >> shift) & 255) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/** White text on saturated/dark accents, near-black on bright ones. */
export function foregroundFor(hex: string): string {
  return luminance(hex) > 0.45 ? '256 60% 9%' : '0 0% 100%';
}

/** Apply an accent (hex) immediately by setting inline CSS variables. */
export function applyAccent(hex: string): void {
  if (typeof document === 'undefined') return;
  const triplet = hexToHslTriplet(hex);
  if (!triplet) return;
  const root = document.documentElement;
  root.style.setProperty('--primary', triplet);
  root.style.setProperty('--primary-foreground', foregroundFor(hex));
  root.style.setProperty('--ring', triplet);
}

/** Remove the inline override — the stylesheet default (violet) returns. */
export function clearAccent(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.removeProperty('--primary');
  root.style.removeProperty('--primary-foreground');
  root.style.removeProperty('--ring');
  try {
    localStorage.removeItem(ACCENT_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function getStoredAccent(): string | null {
  try {
    return localStorage.getItem(ACCENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeAccent(hex: string): void {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, hex);
  } catch {
    /* private mode */
  }
}
