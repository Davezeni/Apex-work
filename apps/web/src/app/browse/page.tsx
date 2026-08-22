'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { ArrowLeft, Star, MapPin, Loader2, SlidersHorizontal } from 'lucide-react';
import { CATEGORIES } from '@apex-work/shared';
import { cn, formatEtb } from '@/lib/utils';
import { useGigs, type GigListItem } from '@/hooks/use-gigs';
import { useI18n } from '@/i18n';

const AVATAR_GRADIENTS = [
  'from-violet-500 to-emerald-500',
  'from-amber-500 to-red-500',
  'from-cyan-500 to-violet-500',
  'from-emerald-500 to-amber-500',
  'from-red-500 to-violet-500',
];
function gradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]!;
}

type SortKey = 'recent' | 'rating' | 'price_asc' | 'price_desc';

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <BrowseInner />
    </Suspense>
  );
}

function BrowseInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const categoryFromUrl = params.get('category');
  const [category, setCategory] = useState<string | null>(categoryFromUrl);
  const [sort, setSort] = useState<SortKey>('recent');

  // Localise the category label (name from constants stays English, but the
  // 'All categories' pseudo-option needs to translate).

  const { data, isLoading } = useGigs({
    category: category ?? undefined,
    limit: 30,
  });

  const setCategoryUrl = (c: string | null) => {
    setCategory(c);
    const qs = c ? `?category=${c}` : '';
    router.replace(`/browse${qs}`);
  };

  const sorted = [...(data?.items ?? [])].sort((a, b) => {
    if (sort === 'rating') return b.rating - a.rating || b.ratingCount - a.ratingCount;
    if (sort === 'price_asc') return a.startingPriceEtb - b.startingPriceEtb;
    if (sort === 'price_desc') return b.startingPriceEtb - a.startingPriceEtb;
    return 0; // recent — API returns createdAt desc by default
  });

  const activeCat = category ? CATEGORIES.find((c) => c.id === category) : null;

  return (
    <MobileShell activeTab="search">
      <header className="safe-top sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-3 pb-3 pt-4 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">
          {activeCat ? `${activeCat.icon} ${activeCat.label}` : t('browse.title')}
        </h1>
      </header>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto px-4 py-4 no-scrollbar">
        <FilterChip
          label={t('browse.allCategories')}
          active={!category}
          onClick={() => setCategoryUrl(null)}
        />
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c.id}
            label={`${c.icon} ${c.label}`}
            active={category === c.id}
            onClick={() => setCategoryUrl(c.id)}
          />
        ))}
      </div>

      {/* Sort dropdown */}
      <div className="flex items-center justify-between px-5 pb-3">
        <span className="text-xs text-muted-foreground">
          {isLoading ? '…' : t('browse.resultsCount', { count: sorted.length })}
        </span>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground outline-none"
          >
            <option value="recent">{t('browse.recent')}</option>
            <option value="rating">{t('browse.rating')}</option>
            <option value="price_asc">{t('browse.priceLow')}</option>
            <option value="price_desc">{t('browse.priceHigh')}</option>
          </select>
        </label>
      </div>

      {isLoading && (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="mx-5 mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="text-3xl">🌱</div>
          <p className="mt-2 text-sm font-semibold">{t('home.noGigsInCategory')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('home.postFirst')}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 px-4 pb-8">
        {sorted.map((g) => (
          <BrowseCard key={g.id} g={g} />
        ))}
      </div>
    </MobileShell>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-all active:scale-95',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/40'
          : 'border-border bg-card text-muted-foreground',
      )}
    >
      {label}
    </button>
  );
}

function BrowseCard({ g }: { g: GigListItem }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/gigs/${g.slug}`}
      className="flex gap-3 rounded-2xl border border-border bg-card p-3 active:scale-[.99]"
    >
      <div className={cn('h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br', gradientFor(g.id))} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-semibold leading-tight">{g.title}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          {g.ratingCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {g.rating.toFixed(1)} ({g.ratingCount})
            </span>
          )}
          {g.owner.city && (
            <>
              {g.ratingCount > 0 && <span>·</span>}
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {g.owner.city}
              </span>
            </>
          )}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {t('browse.byShort')}{' '}
          <span className="font-semibold text-foreground">{g.owner.fullName}</span>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {t('gig.from')}{' '}
          <span className="text-sm font-extrabold text-foreground">
            {formatEtb(g.startingPriceEtb)}
          </span>
        </div>
      </div>
    </Link>
  );
}
