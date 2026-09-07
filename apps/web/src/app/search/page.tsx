'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Search as SearchIcon, Star, Loader2, Briefcase, User as UserIcon, Package as PackageIcon, BellPlus, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useGlobalSearch, useSuggest } from '@/hooks/use-search';
import { useCreateSavedSearch } from '@/hooks/use-saved-searches';
import { useStartConversation } from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { cn, formatEtb, timeAgo } from '@/lib/utils';
import { VoiceSearch } from '@/components/chat/voice-search';
import { UserAvatar } from '@/components/ui/user-avatar';
import { MobileShell } from '@/components/mobile/mobile-shell';

type Tab = 'all' | 'gigs' | 'jobs' | 'users';

export default function SearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const initialQ = params.get('q') ?? '';
  const [q, setQ] = useState(initialQ);
  const debouncedQ = useDeferredValue(q);
  const [tab, setTab] = useState<Tab>('all');
  const [suggestOpen, setSuggestOpen] = useState(false);

  const { data, isLoading, isFetching } = useGlobalSearch(debouncedQ, 15);
  const { data: sug } = useSuggest(q);
  const { data: me, isAuthed } = useMe();
  const startConversation = useStartConversation();
  const saveSearch = useCreateSavedSearch();

  const doSaveSearch = async () => {
    const type = tab === 'gigs' ? 'GIGS' : tab === 'jobs' ? 'JOBS' : 'USERS';
    const name = window.prompt('Name for this saved search', q.slice(0, 40)) ?? '';
    if (!name.trim()) return;
    try {
      await saveSearch.mutateAsync({
        name: name.trim(), type, query: q.trim(),
        emailEnabled: true, pushEnabled: true,
      });
      toast.success(`Saved · we'll ping you when new ${type.toLowerCase()} match`);
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Save failed');
    }
  };

  useEffect(() => {
    if (initialQ) setQ(initialQ);
  }, [initialQ]);

  const anyResults = !!data && (data.gigs.length + data.jobs.length + data.users.length > 0);

  return (
    <MobileShell>
      <div className="min-h-dvh bg-background pb-24">
        <header className="safe-top sticky top-0 z-10 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => { setQ(e.target.value); setSuggestOpen(true); }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                placeholder="Search gigs, jobs, people…"
                className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-10 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              />
              {q && (
                <button
                  onClick={() => setQ('')}
                  aria-label="Clear"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-muted text-xs"
                >×</button>
              )}
            </div>
            <VoiceSearch size="sm" onResult={(txt) => setQ(txt)} />
          </div>

          {/* Suggestions dropdown */}
          {suggestOpen && (sug?.items?.length ?? 0) > 0 && (
            <div className="absolute inset-x-3 top-16 z-30 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
              {sug!.items.map((s, i) => {
                const href =
                  s.type === 'gig' ? `/gigs/${s.ref}` :
                  s.type === 'user' ? `/u/${s.ref}` :
                  `/search?q=${encodeURIComponent(s.text)}`;
                return (
                  <Link key={i} href={href} onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSuggestOpen(false); setQ(s.text); }}
                    className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-sm active:bg-muted"
                  >
                    <span className="text-muted-foreground">
                      {s.type === 'gig' ? <PackageIcon className="h-4 w-4" /> :
                        s.type === 'user' ? <UserIcon className="h-4 w-4" /> :
                          s.type === 'job' ? <Briefcase className="h-4 w-4" /> :
                            <SearchIcon className="h-4 w-4" />}
                    </span>
                    <span className="flex-1 truncate">{s.text}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{s.type}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Tabs */}
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {(['all', 'gigs', 'jobs', 'users'] as Tab[]).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold capitalize',
                  tab === tb ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground',
                )}
              >
                {tb}
                {tb !== 'all' && data && (
                  <span className="ml-1 text-[10px] opacity-60">
                    {tb === 'gigs' ? data.gigs.length : tb === 'jobs' ? data.jobs.length : data.users.length}
                  </span>
                )}
              </button>
            ))}
            {isAuthed && q.trim().length >= 2 && tab !== 'all' && (
              <button
                onClick={doSaveSearch}
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary active:scale-95"
                disabled={saveSearch.isPending}
              >
                <BellPlus className="h-3 w-3" /> Save + alert
              </button>
            )}
          </div>
        </header>

        {q.trim().length < 2 && (
          <div className="mx-4 mt-12 text-center">
            <div className="grad-hero mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg shadow-primary/40">
              <SearchIcon className="h-8 w-8" />
            </div>
            <p className="mt-4 text-sm font-semibold">Search the whole marketplace</p>
            <p className="mt-1 text-xs text-muted-foreground">Type at least 2 letters — try &ldquo;react&rdquo;, &ldquo;amharic&rdquo;, &ldquo;logo&rdquo;.</p>
          </div>
        )}

        {q.trim().length >= 2 && (isLoading || (isFetching && !data)) && (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {q.trim().length >= 2 && data && !anyResults && (
          <div className="mx-4 mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm font-semibold">No matches</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different spelling or fewer words.</p>
          </div>
        )}

        {data && anyResults && (
          <div className="mx-3 mt-4 space-y-6">
            {(tab === 'all' || tab === 'gigs') && data.gigs.length > 0 && (
              <ResultGroup title="Gigs" icon={<PackageIcon className="h-3 w-3" />}>
                <div className="grid grid-cols-2 gap-2">
                  {data.gigs.map((g) => (
                    <Link key={g.id} href={`/gigs/${g.slug}`} className="rounded-2xl border border-border bg-card p-2">
                      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                        {g.coverImageUrl && <Image src={g.coverImageUrl} alt={g.title} fill unoptimized className="object-cover" />}
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs font-semibold">{g.title}</div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {g.rating.toFixed(1)} · {formatEtb(g.startingPriceEtb)}+
                      </div>
                    </Link>
                  ))}
                </div>
              </ResultGroup>
            )}

            {(tab === 'all' || tab === 'jobs') && data.jobs.length > 0 && (
              <ResultGroup title="Jobs" icon={<Briefcase className="h-3 w-3" />}>
                <div className="space-y-2">
                  {data.jobs.map((j) => (
                    <Link key={j.id} href={`/jobs/${j.id}`} className="block rounded-2xl border border-border bg-card p-3">
                      <div className="text-xs font-semibold text-muted-foreground">{j.client.fullName} · {timeAgo(j.createdAt)}</div>
                      <div className="mt-1 line-clamp-2 text-sm font-bold">{j.title}</div>
                      <div className="mt-1 text-[10px] text-primary font-bold">
                        {j.budgetMinEtb && j.budgetMaxEtb ? `${formatEtb(j.budgetMinEtb)} – ${formatEtb(j.budgetMaxEtb)}` : 'Open budget'}
                      </div>
                    </Link>
                  ))}
                </div>
              </ResultGroup>
            )}

            {(tab === 'all' || tab === 'users') && data.users.length > 0 && (
              <ResultGroup title="People" icon={<UserIcon className="h-3 w-3" />}>
                <div className="space-y-2">
                  {data.users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                      <Link href={`/u/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <UserAvatar name={u.fullName} avatarUrl={u.avatarUrl} id={u.id} verified={u.isVerified} className="h-10 w-10 text-sm font-bold" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold">{u.fullName}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {u.title ?? '@' + u.username}{u.city ? ` · ${u.city}` : ''}
                          </div>
                        </div>
                        {u.ratingCount > 0 && (
                          <div className="text-[11px] font-bold text-primary">
                            <Star className="mr-0.5 inline h-3 w-3 fill-amber-400 text-amber-400" />{u.rating.toFixed(1)}
                          </div>
                        )}
                      </Link>
                      {me && me.id !== u.id && (
                        <button
                          onClick={() =>
                            startConversation.mutate(u.id, {
                              onSuccess: (c) => router.push(`/messages/${c.id}`),
                              onError: (e) => toast.error((e as Error).message),
                            })
                          }
                          disabled={startConversation.isPending}
                          aria-label={`Message ${u.fullName}`}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform active:scale-90 hover:text-primary"
                        >
                          {startConversation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MessageCircle className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </ResultGroup>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  );
}

function ResultGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}
