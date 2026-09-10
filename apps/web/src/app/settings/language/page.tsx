'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { useI18n, type Locale } from '@/i18n';
import { LOCALE_LABELS } from '@apex-work/shared';
import { cn } from '@/lib/utils';

const LOCALES: Locale[] = ['en', 'am', 'om', 'ti'];

export default function LanguageSettingsPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.language')}</h1>
      </header>

      <div className="mx-3 mt-4 space-y-2">
        {LOCALES.map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-colors',
              locale === l ? 'border-primary bg-primary/10' : 'border-border bg-card',
            )}
          >
            <div className="text-2xl">{l === 'en' ? '🌍' : '🇪🇹'}</div>
            <div className="flex-1">
              <div className="text-sm font-bold">{LOCALE_LABELS[l]}</div>
              <div className="text-[11px] text-muted-foreground">
                {l === 'en'
                  ? 'English'
                  : l === 'am'
                    ? 'አማርኛ'
                    : l === 'om'
                      ? 'Afaan Oromoo'
                      : 'ትግርኛ'}
              </div>
            </div>
            {locale === l && <Check className="h-5 w-5 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}
