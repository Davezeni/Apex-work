'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
/**
 * Prompts the user to install the PWA to their home screen.
 *
 * We only show it:
 *   - On mobile (viewport check)
 *   - When the browser fires 'beforeinstallprompt' (Chrome/Edge/Samsung on Android)
 *   - When the app isn't already installed (display-mode: standalone check)
 *   - When the user hasn't dismissed the prompt in the last 14 days
 */
const DISMISS_KEY = 'apex-work-pwa-dismissed-at';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already installed?
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (
      'standalone' in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone
    )
      return;

    // Recently dismissed?
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // Delay 8s so we don't nag as soon as the page loads.
      setTimeout(() => setVisible(true), 8000);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  };

  const install = async () => {
    if (!deferred) return dismiss();
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user cancelled */
    }
    dismiss();
  };

  if (!visible || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label={dt('Install Apex-Work')}
      className="safe-bottom fixed inset-x-3 bottom-24 z-50 animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-lg md:inset-x-auto md:bottom-6 md:right-6 md:max-w-sm"
    >
      <button
        onClick={dismiss}
        aria-label={dt('Dismiss')}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="grad-hero grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{dt('Install Apex-Work')}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add it to your home screen for a fast, native-app experience.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="grad-hero rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
