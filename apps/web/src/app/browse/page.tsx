'use client';

import { dt } from '@/i18n/auto';
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
import { Marquee } from '@/components/ui/marquee';
import { cn, formatEtb } from '@/lib/utils';
import { useGigs, type GigListItem } from '@/hooks/use-gigs';
import Image from 'next/image';
import { JobsBoard } from '@/app/jobs/page';
import { useMe } from '@/hooks/use-me';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/i18n';
import { gradientFor } from '@/components/ui/avatar-gradient';
import { ThemeToggle } from '@/components/theme-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { RecentlyViewedRow } from '@/components/home/recently-viewed';
import { VoiceSearch } from '@/components/chat/voice-search';
import { safeBack } from '@/lib/safe-back';
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
  const { data: me, isError, fetchStatus } = useMe();
  const isFreelancer = me?.role === 'FREELANCER';
  const params = useSearchParams();
  // Jobs first for freelancers (they hunt work); gigs first for clients.
  // ?tab=jobs|gigs (sidebar links, deep links) overrides the role default.
  const tabFromUrl = params.get('tab');
  // Derived, NOT frozen in useState: the role is usually still loading at
  // mount, so a frozen default stranded freelancers on the gigs view. This
  // re-derives the moment `me` arrives; explicit ?tab= still wins (deep links).
  const tab: 'jobs' | 'gigs' =
    tabFromUrl === 'jobs' || tabFromUrl === 'gigs' ? tabFromUrl : isFreelancer ? 'jobs' : 'gigs';
  // Until the role is known (and no explicit ?tab=), show a quiet spinner
  // instead of guessing gigs — no wrong-role flash. Idle query = no session,
  // stop waiting and fall back to the client default.
  const waitingForRole = !tabFromUrl && !me && !isError && fetchStatus !== 'idle';
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

  // Debounced search term: the raw `query` updates instantly in the box, but
  // we only hit the API after a short pause, so keystrokes don't spam the
  // server. Empty matches "all" (server returns everything).
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

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
    q: searchTerm || undefined,
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
      const p = new URLSearchParams({ limit: '30', cursor });
      if (category) p.set('category', category);
      if (searchTerm) p.set('q', searchTerm);
      const next = await apiFetch<{
        items: GigListItem[];
        nextCursor: string | null;
        hasMore: boolean;
      }>(`/gigs?${p.toString()}`);
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

  // The server already filters by the search term + category, so `items` is a
  // complete result set across all pages. We only re-sort locally for the
  // price/rating toggle (the API default order is createdAt desc = "recent").
  const sorted = [...items].sort((a, b) => {
    if (sort === 'rating') return b.rating - a.rating || b.ratingCount - a.ratingCount;
    if (sort === 'price_asc') return a.startingPriceEtb - b.startingPriceEtb;
    if (sort === 'price_desc') return b.startingPriceEtb - a.startingPriceEtb;
    return 0; // recent — API returns createdAt desc by default
  });

  const activeCat = category ? CATEGORIES.find((c) => c.id === category) : null;

  return (
    <MobileShell activeTab="search">
      {!waitingForRole && tab !== 'jobs' && (
        <header className="safe-top sticky top-0 z-30 border-b border-border bg-background/85 px-4 pb-3 pt-4 backdrop-blur-xl md:px-6 md:pt-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => safeBack(router)}
              aria-label={t('common.back')}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-muted md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-extrabold tracking-tight md:text-2xl md:font-black">
                {activeCat ? `${activeCat.icon} ${activeCat.label}` : t('browse.title')}
              </h1>
              <p className="hidden text-sm text-muted-foreground md:block">
                {t('browse.subtitle')}
              </p>
            </div>
            {/* Mobile theme toggle — desktop gets the shell-level one (top-right). */}
            <div className="shrink-0 md:hidden">
              <ThemeToggle />
            </div>
          </div>

          {/* Desktop search input with focus glow */}
          <div className="mt-4 hidden md:block">
            <div className="flex h-12 max-w-xl items-center gap-2.5 rounded-2xl border border-border bg-card px-4 shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-lg focus-within:shadow-primary/10 focus-within:ring-2 focus-within:ring-primary/15">
              <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
              <input
                id="browse-search"
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
              <VoiceSearch size="sm" onResult={(txt) => setQuery(txt)} />
            </div>
          </div>
        </header>
      )}

      {waitingForRole && (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Freelancers land here: the posted-jobs board (what they came for). */}
      {!waitingForRole && tab === 'jobs' && <JobsBoard />}

      {!waitingForRole && tab !== 'jobs' && (
        <>
          {/* Category filter — auto-scrolls while idle (rAF marquee); a
              normal scrollable row once a filter is picked. */}
          <div className="py-4">
            {!category ? (
              <Marquee className="overflow-hidden" speed={50}>
                <div className="flex shrink-0 gap-2 px-4 md:px-6">
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
              </Marquee>
            ) : (
              <div className="no-scrollbar flex w-max gap-2 overflow-x-auto px-4 md:px-6">
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
            )}
          </div>

          {/* Device-local recently viewed gigs — shown only when browsing unfiltered */}
          {!category && !query && <RecentlyViewedRow dense />}

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
                  aria-label={dt('List view')}
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
                  aria-label={dt('Grid view')}
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
                'mx-auto grid max-w-7xl gap-4 px-4 pb-8 transition-all',
                view === 'grid'
                  ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5'
                  : 'grid-cols-1',
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
                ? 'mx-auto grid max-w-7xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5'
                : 'mx-auto flex max-w-7xl flex-col gap-3',
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
        </>
      )}
    </MobileShell>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tabIndex,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tabIndex?: number;
}) {
  return (
    <button
      onClick={onClick}
      tabIndex={tabIndex}
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
            'relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-[1.04]',
            gradientFor(g.id),
          )}
        >
          {g.coverImageUrl && (
            <Image src={g.coverImageUrl} alt={g.title} fill sizes="80px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-primary">
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
            <span className="text-sm font-extrabold tabular-nums text-primary">
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
  const catIcon = CATEGORIES.find((c) => c.id === g.categoryId)?.icon ?? '✨';
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 360, damping: 24 }}
      className="h-full"
    >
      <Link
        href={`/gigs/${g.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border transition-all duration-300 hover:shadow-xl hover:shadow-primary/15 hover:ring-primary/40 active:scale-[.99]"
      >
        {/* Cover — real photo, or a rich category gradient fallback */}
        <div
          className={cn(
            'relative aspect-[16/10] w-full shrink-0 overflow-hidden',
            gradientFor(g.id),
          )}
        >
          {g.coverImageUrl ? (
            <Image
              src={g.coverImageUrl}
              alt={g.title}
              fill
              sizes="300px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            />
          ) : (
            <>
              <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full border-[10px] border-white/10" />
              <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full border-[14px] border-white/10" />
              <span className="absolute inset-0 grid place-items-center text-5xl drop-shadow-sm transition-transform duration-500 group-hover:scale-110">
                {catIcon}
              </span>
            </>
          )}
          {/* subtle cover shimmer on hover */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          {g.isFeatured && (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-extrabold text-amber-950 shadow-sm">
              ⚡ {t('gig.featured')}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3.5">
          <div className="line-clamp-2 min-h-[2.6rem] text-[13px] font-bold leading-[1.3] tracking-[-0.01em]">
            {g.title}
          </div>
          <div className="mb-3 mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {g.ratingCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-foreground">{g.rating.toFixed(1)}</span>
                <span>({g.ratingCount})</span>
              </span>
            ) : (
              <span className="font-medium">{dt('New')}</span>
            )}
            {g.owner.city && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex min-w-0 items-center gap-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{g.owner.city}</span>
                </span>
              </>
            )}
            {g.owner.agencyMemberships?.[0]?.agency && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate font-medium text-primary/80">
                  🏢 {g.owner.agencyMemberships[0].agency.name}
                </span>
              </>
            )}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full text-[9px] font-bold text-white',
                  gradientFor(g.owner.id),
                )}
              >
                {g.owner.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.owner.avatarUrl}
                    alt={g.owner.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (g.owner.fullName[0] ?? '?').toUpperCase()
                )}
              </span>
              <span className="truncate text-[11px] font-semibold">
                {g.owner.fullName.split(' ')[0]}
              </span>
              {g.owner.isVerified && (
                <CheckCircle2 className="h-3 w-3 shrink-0 fill-cyan-400 text-white" />
              )}
            </div>
            <div className="shrink-0 text-right leading-none">
              <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('gig.from')}
              </div>
              <div className="mt-1 text-[13px] font-extrabold tabular-nums text-primary">
                {formatEtb(g.startingPriceEtb)}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
