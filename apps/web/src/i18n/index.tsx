'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import enMessages from './messages/en.json';
import amMessages from './messages/am.json';

export type Locale = 'en' | 'am';
type Messages = typeof enMessages;

const BUNDLES: Record<Locale, Messages> = {
  en: enMessages,
  am: amMessages as Messages,
};

const STORAGE_KEY = 'apex-work-locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Resolve a dot-separated key against a nested messages object.
 * Falls back to the key itself if the path doesn't exist (helpful during dev).
 */
function resolve(obj: unknown, path: string): string | null {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : null;
}

/**
 * Interpolate {placeholders} in a string with values from `params`.
 * Unknown placeholders are left as-is (so bugs are visible in dev).
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start with 'en' on the server (must be deterministic for SSR). We hydrate
  // the user's saved preference on mount to avoid a hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === 'en' || saved === 'am') setLocaleState(saved);
    else {
      // Optional: default to Amharic for users with Amharic in Accept-Language.
      const preferred = navigator.language?.toLowerCase();
      if (preferred?.startsWith('am')) setLocaleState('am');
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, l);
      // Update <html lang="…"> for a11y + browser translation heuristics.
      document.documentElement.lang = l;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const bundle = BUNDLES[locale];
      const val =
        resolve(bundle, key) ??
        // Fall back to English if the key is missing in the current locale.
        resolve(BUNDLES.en, key) ??
        key;
      return interpolate(val, params);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Read the current locale + translation function.
 * Falls back to identity so we don't crash if used outside the provider
 * (e.g. Storybook, tests) — keys will render as-is.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: 'en',
      setLocale: () => {},
      t: (key: string, params?: Record<string, string | number>) =>
        interpolate(resolve(enMessages, key) ?? key, params),
    };
  }
  return ctx;
}

/** Convenience export for components that only need the translator. */
export function useT() {
  return useI18n().t;
}
