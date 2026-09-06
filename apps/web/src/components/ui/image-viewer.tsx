'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  alt?: string;
  /** Optional gallery of image URLs for prev/next navigation. */
  images?: string[];
  imageIndex?: number;
  onImageIndex?: (index: number) => void;
}

/**
 * Full-screen image viewer with prev/next navigation, tap-to-zoom and a
 * working close button (the controls are layered above the image so clicks
 * always reach them). Closes on Escape / outside tap.
 */
export function ImageViewer({ open, onOpenChange, url, alt, images, imageIndex = 0, onImageIndex }: Props) {
  const { t } = useI18n();
  const [zoomed, setZoomed] = useState(false);

  const gallery = images && images.length > 0 ? images : url ? [url] : [];
  const current = gallery[imageIndex] ?? url ?? null;
  const isMulti = gallery.length > 1;

  useEffect(() => {
    if (!open) return;
    setZoomed(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
      if (isMulti && e.key === 'ArrowLeft') onImageIndex?.((imageIndex - 1 + gallery.length) % gallery.length);
      if (isMulti && e.key === 'ArrowRight') onImageIndex?.((imageIndex + 1) % gallery.length);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange, isMulti, imageIndex, gallery.length, onImageIndex]);

  if (!open || !current) return null;

  const goPrev = () => onImageIndex?.((imageIndex - 1 + gallery.length) % gallery.length);
  const goNext = () => onImageIndex?.((imageIndex + 1) % gallery.length);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt ?? 'Image'}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md"
      onClick={() => onOpenChange(false)}
    >
      {/* Top bar */}
      <div className="safe-top z-20 flex items-center justify-between px-4 py-3">
        <button
          onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
          aria-label="Zoom"
          className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-lg active:scale-90"
        >
          {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
        </button>
        {isMulti && (
          <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white backdrop-blur-lg">
            {t('viewer.of', { i: imageIndex + 1, n: gallery.length })}
          </span>
        )}
        <div className="flex gap-2">
          <a
            href={current}
            download
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={t('viewer.download')}
            className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-lg active:scale-90"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}
            aria-label={t('viewer.close')}
            className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-lg active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {isMulti && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous image"
            className="absolute left-2 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-lg active:scale-90"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
          aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
          className={cn('relative z-10 h-full w-full', zoomed ? 'overflow-auto' : '')}
        >
          <div className={cn('relative h-full w-full', zoomed ? 'scale-[1.6] p-8' : 'p-1')}>
            <Image
              src={current}
              alt={alt ?? 'Attachment'}
              fill
              unoptimized
              sizes="95vw"
              className={cn('object-contain', zoomed && 'cursor-zoom-out')}
              priority
            />
          </div>
        </button>
        {isMulti && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next image"
            className="absolute right-2 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-lg active:scale-90"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
