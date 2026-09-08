'use client';

import Link from 'next/link';
import Image from 'next/image';
import { History, Star, X } from 'lucide-react';
import { useRecentlyViewed } from '@/hooks/use-recently-viewed';
import { useI18n } from '@/i18n';
import { cn, formatEtb } from '@/lib/utils';

/**
 * Device-local "Recently viewed" gigs. Lets a returning visitor jump straight
 * back to gigs they looked at, even before / without signing in. Renders a
 * compact horizontal scroll row and a Clear action. Nothing is shown when the
 * list is empty (and nothing is persisted until the visitor views a gig).
 */
export function RecentlyViewedRow({ dense = false }: { dense?: boolean }) {
  const { t } = useI18n();
  const { items, clear } = useRecentlyViewed();

  if (items.length === 0) return null;

  return (
    <section className={cn('pb-6', dense ? 'px-4 md:px-6' : 'px-5')}>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
          <History className="h-4 w-4 text-primary" />
          {t('home.recentlyViewed')}
        </h2>
        <button
          onClick={clear}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          {t('home.clear')}
        </button>
      </div>

      <div
        className={cn(
          'no-scrollbar flex gap-2.5 overflow-x-auto pb-1',
          dense ? '-mx-4 px-4 md:-mx-6 md:px-6' : '-mx-5 px-5',
        )}
      >
        {items.map((g) => (
          <Link
            key={g.slug}
            href={`/gigs/${g.slug}`}
            className={cn(
              'group shrink-0 overflow-hidden rounded-2xl border border-border bg-card transition-transform active:scale-[0.98]',
              dense ? 'w-44' : 'w-36',
            )}
          >
            <div className="relative aspect-video overflow-hidden bg-muted">
              {g.coverImageUrl ? (
                <Image
                  src={g.coverImageUrl}
                  alt={g.title}
                  fill
                  unoptimized
                  className="object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-2xl">
                  {g.title.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="p-2.5">
              <div className="line-clamp-2 min-h-[2rem] text-xs font-semibold leading-tight">
                {g.title}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-primary">
                  {formatEtb(g.startingPriceEtb)}+
                </span>
                {g.rating && (g.ratingCount ?? 0) > 0 && (
                  <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {g.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
