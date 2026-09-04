'use client';

import { useEffect, useState } from 'react';
import { setConsent } from '@/lib/analytics';

const CONSENT_KEY = 'apx-consent';

/**
 * Lightweight analytics consent banner. Appears once on the first visit; the
 * choice is stored in localStorage. Keyed off a PostHog presence check so it
 * never shows when analytics isn't configured.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasKey = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
    if (!hasKey) return;
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
  }, []);

  if (!visible) return null;

  const choose = (accept: boolean) => {
    setConsent(accept);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-3 inset-x-3 z-[100] rounded-2xl border border-border bg-card p-4 shadow-2xl">
      <p className="text-sm font-semibold">We use analytics</p>
      <p className="mt-1 text-xs text-muted-foreground">
        We use PostHog to understand how people use Apex-Work and improve the marketplace. No
        personal data is sold. You can change this at any time.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => choose(true)}
          className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white"
        >
          Accept
        </button>
        <button
          onClick={() => choose(false)}
          className="flex-1 rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
