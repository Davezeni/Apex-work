'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X, Download } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  alt?: string;
}

/**
 * Full-screen image viewer. Closes on Escape or clicking outside.
 * Delivers a native "download" via a fallback anchor since not every
 * origin honours the Content-Disposition header (Supabase does, but
 * playing it safe).
 */
export function ImageViewer({ open, onOpenChange, url, alt }: Props) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange]);

  if (!open || !url) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/95 backdrop-blur-md"
      onClick={() => onOpenChange(false)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(false);
        }}
        aria-label={t('viewer.close')}
        className={cn(
          'safe-top absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-lg active:scale-90',
        )}
      >
        <X className="h-5 w-5" />
      </button>
      <a
        href={url}
        download
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('viewer.download')}
        className="safe-top absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-lg active:scale-90"
      >
        <Download className="h-5 w-5" />
      </a>
      <div
        className="relative h-full w-full max-h-[90vh] max-w-[95vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={url}
          alt={alt ?? 'Attachment'}
          fill
          unoptimized
          sizes="95vw"
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
