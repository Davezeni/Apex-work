'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import { MobileShell } from '@/components/mobile/mobile-shell';
import {
  ArrowLeft,
  Star,
  MapPin,
  Loader2,
  SlidersHorizontal,
  LayoutGrid,
  LayoutList,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { CATEGORIES } from '@apex-work/shared';
import { cn, formatEtb } from '@/lib/utils';
import { useGigs, type GigListItem } from '@/hooks/use-gigs';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/i18n';
import { gradientFor } from '@/components/ui/avatar-gradient';
import { Skeleton } from '@/components/ui/skeleton';

const VIEW_MODE_KEY = 'apex-gig-view';
type ViewMode = 'list' | 'grid';

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
  const [view, setView] = useState<ViewMode>('grid');
  const [query, setQuery] = useState('');

  // Persist the list/grid preference so it sticks across visits.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === 'grid') setView('grid');
    } catch {
      /* ignore */
    }
  }, []);
  const setViewMode = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_MODE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  // Localise the category label (name from constants stays English, but the
  // 'All categories' pseudo-option needs to translate).

  // Cursor-paginated feed: keep the accumulated pages so "Load more" appends
  // instead of replacing. `items` holds everything fetched so far; when the
  // cursor/query/category changes we reset back to the first page.
  const [items, setItems] = useState<GigListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { data, isLoading } = useGigs({
    category: category ?? undefined,
    limit: 30,
  });
  // First page result — accuminates the fresh page, replacing any stale acc.
  useEffect(() => {
    if (!data) return;
    setItems(data.items);
    setCursor(data.nextCursor);
    setHasMore(data.hasMore);
  }, [data]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const next = await apiFetch<{
        items: GigListItem[];
        nextCursor: string | null;
        hasMore: boolean;
      }>(`/gigs?limit=30${category ? `&category=${category}` : ''}&cursor=${cursor}`);
      setItems((prev) => {
        const existing = new Set(prev.map((g) => g.id));
        return [...prev, ...next.items.filter((g) => !existing.has(g.id))];
      });
      setCursor(next.nextCursor);
      setHasMore(next.hasMore);
    } catch {
      /* keep current list; button can retry */
    } finally {
      setLoadingMore(false);
    }
  };

  // Auto-fetch the next page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, cursor, category]);

  const setCategoryUrl = (c: string | null) => {
    setCategory(c);
    const qs = c ? `?category=${c}` : '';
    router.replace(`/browse${qs}`);
  };

  const sorted = [...items]
    .filter((g) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return `${g.title} ${g.owner?.fullName ?? ''} ${g.categoryId ?? ''}`
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating || b.ratingCount - a.ratingCount;
      if (sort === 'price_asc') return a.startingPriceEtb - b.startingPriceEtb;
      if (sort === 'price_desc') return b.startingPriceEtb - a.startingPriceEtb;
      return 0; // recent — API returns createdAt desc by default
    });

  const activeCat = category ? CATEGORIES.find((c) => c.id === category) : null;

  return (
    <MobileShell activeTab="search">
      <header className="safe-top sticky top-0 z-30 border-b border-border bg-background/85 px-4 pb-3 pt-4 backdrop-blur-xl md:px-6 md:pt-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label={t('common.back')}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-muted md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold tracking-tight md:text-2xl md:font-black">
              {activeCat ? `${activeCat.icon} ${activeCat.label}` : t('browse.title')}
            </h1>
            <p className="hidden text-sm text-muted-foreground md:block">{t('browse.subtitle')}</p>
          </div>
          <button
            onClick={() => setQuery('')}
            className="hidden text-xs font-semibold text-primary transition-colors hover:text-primary/80 md:block"
          >
            {t('browse.clear')}
          </button>
        </div>

        {/* Desktop search input with focus glow */}
        <div className="mt-4 hidden md:block">
          <div className="flex h-12 max-w-xl items-center gap-2.5 rounded-2xl border border-border bg-card px-4 shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-lg focus-within:shadow-primary/10 focus-within:ring-2 focus-within:ring-primary/15">
            <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('browse.searchPlaceholder')}
              className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label={t('browse.clear')}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs text-muted-foreground transition-colors hover:bg-muted/80"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Category filter — animated chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-4 md:px-6">
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

      {/* Sort + view toggle */}
      <div className="flex items-center justify-between gap-2 px-5 pb-3">
        <span className="text-xs text-muted-foreground">
          {isLoading ? '…' : t('browse.resultsCount', { count: sorted.length })}
        </span>
        <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full transition-colors',
                view === 'list'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full transition-colors',
                view === 'grid'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div
          className={cn(
            'grid gap-4 px-4 pb-8 transition-all',
            view === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1',
          )}
          aria-hidden="true"
        >
          {Array.from({ length: view === 'grid' ? 8 : 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <Skeleton
                className={cn('w-full', view === 'grid' ? 'aspect-[4/3]' : 'aspect-[5/2]')}
              />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="mx-5 mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="text-3xl">🌱</div>
          <p className="mt-2 text-sm font-semibold">{t('home.noGigsInCategory')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('home.postFirst')}</p>
        </div>
      )}

      <div
        className={cn(
          'px-4 pb-8 transition-all',
          view === 'grid'
            ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'
            : 'flex flex-col gap-3',
        )}
      >
        {sorted.map((g, i) => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: Math.min(i * 0.03, 0.35),
              type: 'spring',
              stiffness: 320,
              damping: 28,
            }}
          >
            {view === 'grid' ? <GridCard key={g.id} g={g} /> : <BrowseCard g={g} />}
          </motion.div>
        ))}
      </div>

      {!isLoading && sorted.length > 0 && hasMore && (
        <div ref={sentinelRef} className="flex justify-center px-4 pb-10">
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-muted-foreground active:scale-95 disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
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
        'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:scale-95',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/40'
          : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function BrowseCard({ g }: { g: GigListItem }) {
  const { t } = useI18n();
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.004 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
    >
      <Link
        href={`/gigs/${g.slug}`}
        className="group flex gap-3 rounded-2xl border border-border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[.99]"
      >
        <div
          className={cn(
            'h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-[1.04]',
            gradientFor(g.id),
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-tight group-hover:text-primary">
            {g.title}
          </div>
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
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            {t('browse.byShort')}{' '}
            <span className="font-semibold text-foreground">{g.owner.fullName}</span>
            {g.owner.isVerified && <CheckCircle2 className="h-3 w-3 fill-cyan-400 text-white" />}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {t('gig.from')}{' '}
            <span className="text-sm font-extrabold text-foreground">
              {formatEtb(g.startingPriceEtb)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function GridCard({ g }: { g: GigListItem }) {
  const { t } = useI18n();
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
    >
      <Link
        href={`/gigs/${g.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/15 active:scale-[.99]"
      >
        {/* Cover */}
        <div
          className={cn(
            'relative h-28 w-full overflow-hidden bg-gradient-to-br',
            gradientFor(g.id),
          )}
        >
          {/* subtle cover shimmer on hover */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          {g.isFeatured && (
            <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-white shadow">
              {t('gig.featured')}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight group-hover:text-primary">
            {g.title}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {g.ratingCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {g.rating.toFixed(1)}
              </span>
            )}
            {g.owner.city && (
              <>
                {g.ratingCount > 0 && <span>·</span>}
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{g.owner.city}</span>
                </span>
              </>
            )}
          </div>
          <div className="mt-auto flex items-center justify-between pt-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">
                {g.owner.fullName.split(' ')[0]}
              </span>
              {g.owner.isVerified && <CheckCircle2 className="h-3 w-3 fill-cyan-400 text-white" />}
            </div>
            <div className="text-right">
              <div className="text-[9px] text-muted-foreground">{t('gig.from')}</div>
              <div className="text-sm font-extrabold text-primary">
                {formatEtb(g.startingPriceEtb)}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
