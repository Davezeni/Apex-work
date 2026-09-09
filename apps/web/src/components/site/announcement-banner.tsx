'use client';

import { dt } from '@/i18n/auto';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { API_BASE } from '@/lib/api';
interface Announcement {
  id: string;
  text: string;
  href?: string;
  cta?: string;
  tone: 'info' | 'promo' | 'urgent';
}

const toneCls: Record<string, string> = {
  info: 'bg-primary/10 text-primary',
  promo: 'bg-emerald-500/15 text-emerald-600',
  urgent: 'bg-red-500/15 text-red-600',
};

/**
 * Site-wide announcement banner. Reads the public `/content/announcement`
 * endpoint (admin-managed) and shows a dismissible bar above the header.
 * Dismissal is remembered per-session.
 */
export function AnnouncementBanner() {
  const [ann, setAnn] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/v1/content/announcement`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setAnn(d?.announcement ?? null);
      })
      .catch(() => {
        if (active) setAnn(null);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded || !ann || dismissed) return null;

  const body = (
    <div
      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-xs font-semibold ${toneCls[ann.tone] ?? toneCls.info}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Megaphone className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{ann.text}</span>
        {ann.cta && (
          <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold">
            {ann.cta}
          </span>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label={dt('Close announcement')}
        className="shrink-0 rounded-full p-1 hover:bg-foreground/10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (ann.href) {
    return (
      <Link href={ann.href} className="block" onClick={() => setDismissed(true)}>
        {body}
      </Link>
    );
  }
  return <div>{body}</div>;
}
