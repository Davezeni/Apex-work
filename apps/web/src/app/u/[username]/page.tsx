'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowLeft,
  Share2,
  CheckCircle2,
  MapPin,
  Star,
  MessageCircle,
  Loader2,
  Wallet,
  Package,
  UserX,
  MoreVertical,
  Flag,
  ShieldOff,
  ShieldCheck,
  FileText,
  Video,
  Camera,
} from 'lucide-react';
import { LazyReportUserSheet as ReportUserSheet } from '@/components/lazy';
import { useBlockUser } from '@/hooks/use-moderation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { usePublicUser, type PublicUser } from '@/hooks/use-public-user';
import { usePublicUserStats } from '@/hooks/use-public-stats';
import { usePublicTrust, type TrustProfile } from '@/hooks/use-trust';
import { useMe } from '@/hooks/use-me';
import { useStartConversation } from '@/hooks/use-chat';
import { cn, formatEtb, timeAgo } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { extensionOf, isImageType, isVideoType } from '@/lib/file-types';
import { gradientFor } from '@/components/ui/avatar-gradient';

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { data: user, isLoading, error } = usePublicUser(username);
  const { data: stats } = usePublicUserStats(username);
  const { data: trust } = usePublicTrust(username);
  const { data: me } = useMe();
  const startConversation = useStartConversation();
  const blockUser = useBlockUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="grid min-h-dvh place-items-center px-8 text-center">
        <div>
          <UserX className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">{t('publicProfile.notFound')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('publicProfile.notFoundBody')}</p>
          <Button asChild variant="brand" className="mt-6">
            <Link href="/">{t('gig.backHome')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isSelf = me?.id === user.id;

  const handleMessage = async () => {
    if (!me) {
      router.push(`/login?next=/u/${user.username}`);
      return;
    }
    if (!me.phone || !me.isPhoneVerified) {
      router.push(`/settings/phone?next=${encodeURIComponent(`/u/${user.username}`)}`);
      return;
    }
    if (isSelf) return;
    try {
      const conv = await startConversation.mutateAsync(user.id);
      router.push(`/messages/${conv.id}`);
    } catch {
      toast.error(t('gig.startFailed'));
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: user.fullName, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast.success(t('publicProfile.linkCopied'));
    }
  };

  return (
    <div className="min-h-dvh pb-24">
      {/* Hero */}
      <div className="relative h-60 overflow-hidden sm:h-80">
        {/* Neutral masthead surface (no brand color) — subtle tonal depth that
            keeps the back/share controls legible in light and dark. */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted via-muted/60 to-transparent dark:from-muted/60 dark:via-muted/30 dark:to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_0%,rgba(255,255,255,0.10),transparent_60%)] dark:bg-[radial-gradient(60%_70%_at_50%_0%,rgba(255,255,255,0.04),transparent_60%)]" />
        <div className="safe-top absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              aria-label="Share"
              className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
            >
              <Share2 className="h-5 w-5" />
            </button>
            {me && me.id !== user.id && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="More"
                  className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-12 z-40 w-48 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-xl">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setReportOpen(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
                      >
                        <Flag className="h-4 w-4" /> {t('report.title')}
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          if (!window.confirm(t('block.body'))) return;
                          blockUser.mutate(
                            { userId: user.id },
                            {
                              onSuccess: () => {
                                toast.success(t('block.blocked'));
                                router.push('/');
                              },
                            },
                          );
                        }}
                        className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-red-500 active:bg-muted"
                      >
                        <ShieldOff className="h-4 w-4" /> {t('block.confirm')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ReportUserSheet
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="USER"
        targetId={user.id}
      />

      {/* Profile card */}
      <div className="mx-4 -mt-12 rounded-2xl border border-border bg-card p-5 shadow-lg lg:mx-auto lg:max-w-4xl">
        <div className="flex items-start gap-3">
          <UserAvatar
            name={user.fullName}
            avatarUrl={user.avatarUrl}
            id={user.id}
            verified={user.isVerified}
            className="h-20 w-20 text-2xl font-bold ring-4 ring-card"
          />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight">
              {user.fullName}
              {user.isVerified && <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />}
            </h1>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
            {user.title && <p className="mt-1 text-sm font-semibold">{user.title}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {user.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {user.city}
                </span>
              )}
              <span>·</span>
              <span>{t('publicProfile.joined', { when: timeAgo(user.createdAt) })}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-border bg-background/50 p-3">
          <Stat n={user.rating > 0 ? user.rating.toFixed(1) : '—'} l={t('profile.rating')} />
          <Stat n={String(user.completedOrders)} l={t('profile.orders')} borderLeft />
          <Stat
            n={user.ratingCount > 0 ? String(user.ratingCount) : '—'}
            l={t('publicProfile.reviews')}
            borderLeft
          />
        </div>

        <div className="mt-4 flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/u/${user.username}/resume`}>
              <FileText className="h-4 w-4" /> {t('publicProfile.cv')}
            </Link>
          </Button>
          {isSelf && (
            <Button asChild variant="brand" className="flex-1">
              <Link href="/settings/profile">
                <Camera className="h-4 w-4" /> {t('editProfile.title')}
              </Link>
            </Button>
          )}
        </div>

        {!isSelf && (
          <div className="mt-2 flex gap-2">
            <Button
              variant="brand"
              className="flex-1"
              onClick={handleMessage}
              disabled={startConversation.isPending}
            >
              {startConversation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <MessageCircle className="h-4 w-4" /> {t('common.message')}
                </>
              )}
            </Button>
            {user.hourlyRateEtb && (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-semibold">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                {formatEtb(user.hourlyRateEtb)}/{t('publicProfile.perHourShort')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add-photo nudge (own profile, no photo yet) */}
      {isSelf && !user.avatarUrl && (
        <div className="mx-4 -mt-2 flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3">
          <Camera className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{t('publicProfile.addPhotoTitle')}</p>
            <p className="text-[11px] text-muted-foreground">{t('publicProfile.addPhotoBody')}</p>
          </div>
          <Button asChild variant="brand" size="sm">
            <Link href="/settings/profile">{t('publicProfile.addPhotoCta')}</Link>
          </Button>
        </div>
      )}

      {/* Bio */}
      {user.bio && (
        <Section title={t('publicProfile.about')}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {user.bio}
          </p>
        </Section>
      )}

      {/* Skills */}
      {user.skills.length > 0 && (
        <Section title={`${t('profile.skills')} · ${user.skills.length}`}>
          <div className="flex flex-wrap gap-1.5">
            {user.skills.map((s) => (
              <span
                key={s.id}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground"
              >
                {s.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Track record / hire history */}
      {stats && user.role === 'CLIENT' && (
        <Section title="Client track record">
          <div className="grid grid-cols-3 gap-2">
            <MiniKpi label="Hires" value={String(stats.asClient.hires)} />
            <MiniKpi label="Total spent" value={formatEtb(stats.asClient.totalSpentEtb)} />
            <MiniKpi
              label="Member since"
              value={new Date(user.createdAt).getFullYear().toString()}
            />
          </div>
        </Section>
      )}
      {stats && user.role === 'FREELANCER' && (
        <Section title="Freelancer stats">
          <div className="grid grid-cols-3 gap-2">
            <MiniKpi label="Orders done" value={String(stats.asFreelancer.completedOrders)} />
            <MiniKpi
              label="Lifetime earned"
              value={formatEtb(stats.asFreelancer.lifetimeEarnedEtb)}
            />
            <MiniKpi label="Reviews" value={String(stats.ratingCount)} />
          </div>
        </Section>
      )}

      {/* Explainable trust signals */}
      {user.role === 'FREELANCER' && trust && <TrustCard trust={trust} />}

      {/* Availability */}
      {user.role === 'FREELANCER' && stats?.availability?.hours && (
        <Section title="Availability">
          <AvailabilityGrid data={stats.availability} />
        </Section>
      )}

      {/* Portfolio */}
      {user.portfolio && user.portfolio.length > 0 && (
        <Section title={`${t('portfolio.title')} · ${user.portfolio.length}`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {user.portfolio.map((p) => (
              <PortfolioTile key={p.id} p={p} />
            ))}
          </div>
        </Section>
      )}

      {/* Gigs */}
      {user.gigs.length > 0 && (
        <Section title={`${t('search.gigs')} · ${user.gigs.length}`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {user.gigs.map((g) => (
              <GigMiniCard key={g.id} g={g} owner={user} />
            ))}
          </div>
        </Section>
      )}

      {user.role === 'FREELANCER' && user.gigs.length === 0 && (
        <Section title={t('search.gigs')}>
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {isSelf ? t('publicProfile.noGigsSelf') : t('publicProfile.noGigs')}
            </p>
            {isSelf && (
              <Button asChild variant="brand" size="sm" className="mt-3">
                <Link href="/gigs/new">{t('publicProfile.postFirstGig')}</Link>
              </Button>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

/**
 * Individual portfolio thumbnail. Tapping opens the image full-size in a new
 * tab (poor-man's lightbox — future work: a proper Radix Dialog gallery).
 * `unoptimized` on next/image because Supabase URLs aren't served through
 * Next.js's image optimizer (avoids a re-encode roundtrip; the images are
 * already reasonably sized from the mobile capture flow).
 */
function PortfolioTile({
  p,
}: {
  p: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string;
    externalUrl?: string | null;
    role?: string | null;
    tools?: string[];
    outcome?: string | null;
    featured?: boolean;
  };
}) {
  return (
    <a
      href={p.externalUrl || p.imageUrl}
      target="_blank"
      rel="noreferrer"
      className="group relative block overflow-hidden rounded-2xl border border-border bg-card"
      aria-label={p.title}
    >
      <div className="relative aspect-square bg-muted">
        {isImageType('', p.imageUrl) ? (
          <Image
            src={p.imageUrl}
            alt={p.title}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover transition-transform group-hover:scale-105"
            unoptimized
          />
        ) : isVideoType('', p.imageUrl) ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-black/80 text-white">
            <Video className="h-8 w-8" />
            <span className="text-[10px] font-semibold">Video · Open</span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-primary/5 p-3 text-center text-primary">
            <FileText className="h-8 w-8" />
            <span className="text-[10px] font-bold">{extensionOf(p.imageUrl)} · Open file</span>
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="flex items-center gap-1">
          <div className="line-clamp-1 flex-1 text-xs font-semibold">{p.title}</div>
          {p.featured && (
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
              Featured
            </span>
          )}
        </div>
        {p.role && <div className="mt-0.5 text-[10px] font-semibold text-primary">{p.role}</div>}
        {p.description && (
          <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{p.description}</p>
        )}
        {p.outcome && <p className="mt-1 line-clamp-1 text-[10px] text-emerald-600">{p.outcome}</p>}
        {p.tools && p.tools.length > 0 && (
          <p className="mt-1 line-clamp-1 text-[9px] text-muted-foreground">
            {p.tools.join(' · ')}
          </p>
        )}
      </div>
    </a>
  );
}

function TrustCard({ trust }: { trust: TrustProfile }) {
  const complete = trust.checks.filter((check) => check.complete);
  return (
    <Section title="Apex Trust">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 border-primary/20 bg-primary/5 text-lg font-black text-primary">
            {trust.score}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> {trust.level} trust
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              An explainable score built from verification, delivery, reviews and portfolio proof.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {complete.slice(0, 6).map((check) => (
            <span
              key={check.key}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600"
            >
              <CheckCircle2 className="h-3 w-3" /> {check.label}
            </span>
          ))}
          {complete.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Complete profile signals to build trust.
            </span>
          )}
        </div>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mt-6 lg:mx-auto lg:max-w-4xl">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({ n, l, borderLeft }: { n: string; l: string; borderLeft?: boolean }) {
  return (
    <div className={cn('text-center', borderLeft && 'border-l border-border')}>
      <div className="text-base font-extrabold tracking-tight">{n}</div>
      <div className="text-[10px] text-muted-foreground">{l}</div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="text-sm font-extrabold tracking-tight text-primary">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/**
 * Read-only weekly availability strip. Same 7×9 grid the freelancer edits
 * in /settings/availability. Compact — one column per day, one row per
 * 2-hour block.
 */
function AvailabilityGrid({
  data,
}: {
  data: { hours?: Record<string, boolean[]>; timezone?: string; vacation?: boolean };
}) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['06', '08', '10', '12', '14', '16', '18', '20', '22'];
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      {data.vacation && (
        <div className="mb-2 rounded-lg bg-amber-500/10 px-2 py-1 text-center text-[11px] font-bold text-amber-500">
          🏖 On vacation
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-center text-[10px]">
          <thead>
            <tr>
              <th className="w-8" />
              {days.map((d) => (
                <th key={d} className="pb-1 font-semibold text-muted-foreground">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h, hi) => (
              <tr key={h}>
                <td className="pr-1 text-right text-muted-foreground">{h}</td>
                {days.map((d) => (
                  <td key={d}>
                    <div
                      className={cn(
                        'my-0.5 h-4 w-full rounded',
                        data.hours?.[d]?.[hi] ? 'bg-primary/70' : 'bg-muted',
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-center text-[10px] text-muted-foreground">
        {data.timezone ?? 'Africa/Addis_Ababa'}
      </div>
    </div>
  );
}

function GigMiniCard({ g, owner }: { g: PublicUser['gigs'][number]; owner: PublicUser }) {
  return (
    <Link
      href={`/gigs/${g.slug}`}
      className="flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 active:scale-[.99]"
    >
      <div
        className={cn(
          'grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white',
          gradientFor(g.id),
        )}
      >
        <Package className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-semibold leading-tight">{g.title}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          {g.ratingCount > 0 ? (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-foreground">{g.rating.toFixed(1)}</span> (
              {g.ratingCount})
            </span>
          ) : (
            <span>New</span>
          )}
          <span>·</span>
          <span>@{owner.username}</span>
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          From{' '}
          <span className="text-sm font-extrabold text-foreground">
            {formatEtb(g.startingPriceEtb)}
          </span>
        </div>
      </div>
    </Link>
  );
}
