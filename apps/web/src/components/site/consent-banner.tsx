'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChartPie } from 'lucide-react';
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
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-3 top-3 z-[90] mx-auto max-w-sm rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:left-4 sm:right-auto sm:mx-0"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <ChartPie className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{dt('We use analytics')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            We use PostHog to understand how people use Apex-Work and improve the marketplace. No
            personal data is sold. You can change this at any time.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => choose(true)}
              className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:brightness-110"
            >
              Accept
            </button>
            <button
              onClick={() => choose(false)}
              className="flex-1 rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
