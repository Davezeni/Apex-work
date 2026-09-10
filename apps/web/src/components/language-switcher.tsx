'use client';

import { Globe } from 'lucide-react';
import { useI18n, type Locale } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Compact segmented control for switching between English and Amharic.
 * Persists to localStorage automatically via the I18nProvider.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  const options: { value: Locale; label: string }[] = [
    { value: 'en', label: 'EN' },
    { value: 'am', label: 'አማ' },
    { value: 'om', label: 'Oro' },
    { value: 'ti', label: 'ትግ' },
  ];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-card p-1',
        className,
      )}
      role="radiogroup"
      aria-label={t('language.label')}
    >
      <Globe className="ml-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setLocale(o.value)}
          role="radio"
          aria-checked={locale === o.value}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            locale === o.value
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
