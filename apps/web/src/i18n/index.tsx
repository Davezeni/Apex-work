'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import enMessages from './messages/en.json';
import amMessages from './messages/am.json';
import { setAutoLocale } from './auto';

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

  // Apply the locale to both React state and the module-level auto-translator
  // synchronously, so components that render via dt() pick the right language
  // on the SAME render (no stale-English frame). Keying the subtree by locale
  // below also forces every component — including ones that only use dt() and
  // never call useI18n() — to re-render when the language changes.
  const applyLocale = useCallback((l: Locale) => {
    setAutoLocale(l);
    setLocaleState(l);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
      } catch {
        /* ignore */
      }
      document.documentElement.lang = l;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === 'en' || saved === 'am') applyLocale(saved);
    else {
      // Optional: default to Amharic for users with Amharic in Accept-Language.
      const preferred = navigator.language?.toLowerCase();
      if (preferred?.startsWith('am')) applyLocale('am');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the module-level auto-translator in step if locale changes by any
  // other path (e.g. toggling) so dt() is always correct.
  useEffect(() => {
    setAutoLocale(locale);
  }, [locale]);

  const setLocale = useCallback(
    (l: Locale) => {
      applyLocale(l);
    },
    [applyLocale],
  );

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

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  // Key the subtree by locale so a language switch re-renders every component,
  // including ones that use dt() but never call useI18n() themselves.
  return (
    <I18nContext.Provider value={value}>
      <div key={locale} style={{ display: 'contents' }}>
        {children}
      </div>
    </I18nContext.Provider>
  );
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
