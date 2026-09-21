'use client';

import { dt } from '@/i18n/auto';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Moon, Sun, Monitor, Type, WifiOff, RotateCcw } from 'lucide-react';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  applyAccent,
  clearAccent,
  getStoredAccent,
} from '@/lib/accent';
import { useTheme } from 'next-themes';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';
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
  const [dataSaver, setDataSaver] = useState(false);
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT);

  useEffect(() => {
    const s = (localStorage.getItem('apex-text-size') ?? 'md') as 'sm' | 'md' | 'lg';
    setTextSize(s);
    document.documentElement.style.fontSize = SIZES.find((x) => x.id === s)!.px;
    const savedDataSaver = localStorage.getItem('apex-data-saver') === '1';
    setDataSaver(savedDataSaver);
    document.documentElement.dataset.dataSaver = savedDataSaver ? 'true' : 'false';
    const savedAccent = getStoredAccent();
    if (savedAccent) setAccent(savedAccent);
  }, []);

  const chooseSize = (id: 'sm' | 'md' | 'lg') => {
    setTextSize(id);
    localStorage.setItem('apex-text-size', id);
    document.documentElement.style.fontSize = SIZES.find((x) => x.id === id)!.px;
  };

  const chooseAccent = (hex: string) => {
    setAccent(hex);
    applyAccent(hex);
  };

  const resetAccent = () => {
    setAccent(DEFAULT_ACCENT);
    clearAccent();
  };

  const chooseDataSaver = (enabled: boolean) => {
    setDataSaver(enabled);
    localStorage.setItem('apex-data-saver', enabled ? '1' : '0');
    document.documentElement.dataset.dataSaver = enabled ? 'true' : 'false';
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.appearance')}</h1>
      </header>

      <section className="mx-3 mt-4">
        <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Theme
        </h2>
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
                theme === opt.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card',
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

      <section className="mx-3 mt-6">
        <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {dt('Accent color')}
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-4 gap-3">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => chooseAccent(preset.hex)}
                className="flex flex-col items-center gap-1.5"
                aria-label={preset.name}
              >
                <span
                  className="grid h-11 w-11 place-items-center rounded-full border-2 transition-transform active:scale-90"
                  style={{
                    backgroundColor: preset.hex,
                    borderColor:
                      accent.toLowerCase() === preset.hex.toLowerCase()
                        ? 'hsl(var(--foreground))'
                        : 'transparent',
                  }}
                >
                  {accent.toLowerCase() === preset.hex.toLowerCase() && (
                    <Check className="h-5 w-5 text-white" />
                  )}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <span className="font-semibold text-muted-foreground">{dt('Custom')}</span>
              <input
                type="color"
                value={accent}
                onChange={(e) => chooseAccent(e.target.value)}
                className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
              />
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {accent.toUpperCase()}
              </span>
            </label>
            <button
              type="button"
              onClick={resetAccent}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-muted-foreground active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {dt('Reset')}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {dt('Your color applies instantly across the app — buttons, links, highlights.')}
          </p>
        </div>
      </section>

      <section className="mx-3 mt-6">
        <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <WifiOff className="mr-1 inline h-3 w-3" /> Data saver
        </h2>
        <button
          type="button"
          onClick={() => chooseDataSaver(!dataSaver)}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors',
            dataSaver ? 'border-primary bg-primary/10' : 'border-border bg-card',
          )}
        >
          <div
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
              dataSaver ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <WifiOff className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{dt('Use less data')}</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Reduces decorative animations and effects for faster loading on mobile data.
            </p>
          </div>
          <span
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              dataSaver ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                dataSaver ? 'translate-x-6' : 'translate-x-1',
              )}
            />
          </span>
        </button>
      </section>
    </div>
  );
}
