'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Moon, Sun, Monitor, Type } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const SIZES = [
  { id: 'sm', label: 'Small', px: '14px' },
  { id: 'md', label: 'Default', px: '16px' },
  { id: 'lg', label: 'Large', px: '18px' },
] as const;

export default function AppearancePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [textSize, setTextSize] = useState<'sm' | 'md' | 'lg'>('md');

  useEffect(() => {
    const s = (localStorage.getItem('apex-text-size') ?? 'md') as 'sm' | 'md' | 'lg';
    setTextSize(s);
    document.documentElement.style.fontSize = SIZES.find((x) => x.id === s)!.px;
  }, []);

  const chooseSize = (id: 'sm' | 'md' | 'lg') => {
    setTextSize(id);
    localStorage.setItem('apex-text-size', id);
    document.documentElement.style.fontSize = SIZES.find((x) => x.id === id)!.px;
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.appearance')}</h1>
      </header>

      <section className="mx-3 mt-4">
        <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Theme</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'light', icon: <Sun className="h-5 w-5" />, label: 'Light' },
            { id: 'dark', icon: <Moon className="h-5 w-5" />, label: 'Dark' },
            { id: 'system', icon: <Monitor className="h-5 w-5" />, label: 'System' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-colors',
                theme === opt.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card',
              )}
            >
              {opt.icon}
              <span className="text-xs font-semibold">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mx-3 mt-6">
        <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Type className="mr-1 inline h-3 w-3" /> Text size
        </h2>
        <div className="space-y-2">
          {SIZES.map((s) => (
            <button
              key={s.id}
              onClick={() => chooseSize(s.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-xl border-2 px-4 py-3.5 text-left transition-colors',
                textSize === s.id ? 'border-primary bg-primary/10' : 'border-border bg-card',
              )}
              style={{ fontSize: s.px }}
            >
              <span className="font-semibold">{s.label}</span>
              <span className="text-[11px] text-muted-foreground">{s.px}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
