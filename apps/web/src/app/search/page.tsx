'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { Search, Mic, X, Loader2, Star, MapPin } from 'lucide-react';
import { cn, formatEtb } from '@/lib/utils';
import { useGigs, type GigListItem } from '@/hooks/use-gigs';
import { CATEGORIES } from '@apex-work/shared';
import { useI18n } from '@/i18n';

const RECENT_KEY = 'apex-work-recent-searches';
const TRENDING = [
  'Amharic translator',
  'Logo design',
  'React developer',
  'Wedding video',
  'TikTok editor',
  'Shopify setup',
  'CV writing',
  'Voice over',
];

function getRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  if (typeof window === 'undefined') return;
  const cleaned = q.trim();
  if (!cleaned) return;
  const cur = getRecent().filter((r) => r.toLowerCase() !== cleaned.toLowerCase());
  const next = [cleaned, ...cur].slice(0, 8);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

/**
 * Debounced value hook — returns `value` after `delay` ms of stability.
 * Used for the search input so we don't fire an API call on every keystroke.
 */
function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

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

export default function SearchPage() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q, 250);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(getRecent());
  }, []);

  const { data, isFetching } = useGigs({ q: debouncedQ || undefined, limit: 30 });
  const results = data?.items ?? [];
  const hasQuery = debouncedQ.trim().length > 0;

  const runQuery = (query: string) => {
    setQ(query);
    saveRecent(query);
    setRecent(getRecent());
  };

  const clearRecent = () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  return (
    <MobileShell activeTab="search">
      <header className="safe-top px-5 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('common.search')}</h1>
      </header>

      <div className="px-5 pb-4">
        <div className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-card px-4 focus-within:border-primary">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRecent(q);
            }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={t('search.searchAnything')}
          />
          {q && (
            <button
              onClick={() => setQ('')}
              aria-label="Clear"
              className="grid h-6 w-6 place-items-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <button aria-label="Voice" className="grad-hero grid h-9 w-9 place-items-center rounded-xl text-white">
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results OR discovery */}
      {hasQuery ? (
        <SearchResults q={debouncedQ} results={results} loading={isFetching} />
      ) : (
        <Discovery
          recent={recent}
          onClearRecent={clearRecent}
          onQuery={runQuery}
        />
      )}
    </MobileShell>
  );
}

function SearchResults({
  q,
  results,
  loading,
}: {
  q: string;
  results: GigListItem[];
  loading: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="px-5 pb-8">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {loading ? (
            <Loader2 className="inline h-3 w-3 animate-spin" />
          ) : (
            `${results.length} ${results.length === 1 ? 'gig' : 'gigs'} for "${q}"`
          )}
        </span>
      </div>

      {!loading && results.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="text-3xl">🔎</div>
          <p className="mt-2 text-sm font-semibold">{t('search.noResults')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('search.noResultsBody')}</p>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {results.map((g) => (
          <ResultRow key={g.id} g={g} />
        ))}
      </div>
    </div>
  );
}

function ResultRow({ g }: { g: GigListItem }) {
  return (
    <Link
      href={`/gigs/${g.slug}`}
      className="flex gap-3 rounded-2xl border border-border bg-card p-3 active:scale-[.99]"
    >
      <div
        className={cn(
          'h-16 w-16 shrink-0 rounded-xl bg-gradient-to-br',
          gradientFor(g.id),
        )}
      />
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
          By <span className="font-semibold text-foreground">{g.owner.fullName}</span> · From{' '}
          <span className="font-extrabold text-foreground">{formatEtb(g.startingPriceEtb)}</span>
        </div>
      </div>
    </Link>
  );
}

function Discovery({
  recent,
  onClearRecent,
  onQuery,
}: {
  recent: string[];
  onClearRecent: () => void;
  onQuery: (q: string) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      {recent.length > 0 && (
        <div className="px-5 pb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('search.recent')}
            </h2>
            <button
              onClick={onClearRecent}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <button
                key={r}
                onClick={() => onQuery(r)}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 pb-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t('search.trending')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {TRENDING.map((r) => (
            <button
              key={r}
              onClick={() => onQuery(r)}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              🔥 {r}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-10">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t('home.explore')}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`/browse?category=${c.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 active:scale-[.99]"
            >
              <div className="text-2xl">{c.icon}</div>
              <div className="text-sm font-semibold">{c.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
