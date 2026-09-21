'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Star,
  Timer,
  Users,
  BadgeCheck,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useMe } from '@/hooks/use-me';
import { useAuthStore } from '@/stores/auth-store';
import { useInviteAgencyToJob } from '@/hooks/use-agencies';
import { CATEGORIES } from '@apex-work/shared';
import { cn, formatEtb } from '@/lib/utils';
import { gradientFor } from '@/components/ui/avatar-gradient';
import { safeBack } from '@/lib/safe-back';

interface Storefront {
  agency: {
    id: string;
    name: string;
    slug: string;
    bio: string | null;
    logoUrl: string | null;
    website: string | null;
    verifiedAt: string | null;
    members: {
      role: string;
      user: {
        id: string;
        username: string;
        fullName: string;
        avatarUrl: string | null;
        title: string | null;
        city: string | null;
        rating: number;
        ratingCount: number;
        completedOrders: number;
        isPhoneVerified: boolean;
        isIdVerified: boolean;
      };
    }[];
  };
  gigs: {
    id: string;
    title: string;
    slug: string;
    coverImageUrl: string | null;
    categoryId: string;
    rating: number;
    ratingCount: number;
    startingPriceEtb: number;
    owner: { fullName: string; username: string };
  }[];
  stats: { members: number; gigs: number; avgRating: number; completedOrders: number };
  portfolio: {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    imageUrl: string | null;
  }[];
  reviews: {
    rating: number;
    comment: string | null;
    createdAt: string;
    author: { fullName: string };
  }[];
  teamScore: {
    completedOrders: number;
    avgRating: number;
    onTimePct: number;
    repeatClientPct: number;
    badge: 'NONE' | 'RISING' | 'TOP';
  };
}

interface MyJob {
  id: string;
  title: string;
}

export default function AgencyStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [data, setData] = useState<Storefront | null>(null);
  const [failed, setFailed] = useState(false);

  const { data: me } = useMe();
  const token = useAuthStore((state) => state.accessToken);
  const inviteAgency = useInviteAgencyToJob();
  const isClientViewer = !!me && me.role !== 'FREELANCER';
  const [myJobs, setMyJobs] = useState<MyJob[] | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteJob, setInviteJob] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    if (!isClientViewer || !token) return;
    let active = true;
    apiFetch<{ items: MyJob[] }>('/jobs/mine/open', { token })
      .then((d) => active && setMyJobs(d.items))
      .catch(() => active && setMyJobs([]));
    return () => {
      active = false;
    };
  }, [isClientViewer, token]);

  const sendInvite = () => {
    if (!inviteJob) {
      toast.error(dt('Pick one of your open jobs'));
      return;
    }
    inviteAgency.mutate(
      { jobId: inviteJob, agencyId: data?.agency.id ?? '', message: inviteMsg.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(dt('Invite sent — the team leads are notified'));
          setInviteOpen(false);
          setInviteMsg('');
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setData(null);
    setFailed(false);
    apiFetch<Storefront>(`/agencies/${slug}`)
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [slug]);

  if (failed)
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">{dt('Agency not found')}</p>
          <button
            onClick={() => safeBack(router, '/')}
            className="mt-3 text-sm font-semibold text-primary"
          >
            {dt('Go back')}
          </button>
        </div>
      </div>
    );

  if (!data)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const { agency, gigs, stats } = data;
  const score = data.teamScore;
  const stat = (value: string, label: string) => (
    <div className="rounded-2xl border border-border bg-card px-3 py-2.5 text-center">
      <div className="text-sm font-extrabold">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background pb-16">
      <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router, '/')}
          aria-label={dt('Go back')}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="truncate text-sm font-extrabold">{agency.name}</span>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="grad-hero absolute inset-0 opacity-15" />
        <div className="relative mx-auto max-w-3xl px-4 py-7 text-center">
          <div className="mx-auto h-20 w-20">
            {agency.logoUrl ? (
              <Image
                src={agency.logoUrl}
                alt={agency.name}
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 rounded-3xl object-cover ring-4 ring-background"
              />
            ) : (
              <div className="grad-hero grid h-20 w-20 place-items-center rounded-3xl text-2xl font-extrabold text-white shadow-lg shadow-primary/40">
                {agency.name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-2xl font-black tracking-tight">
            {agency.name}
            {agency.verifiedAt && (
              <span title={dt('Verified team')} className="inline-flex">
                <BadgeCheck className="h-5 w-5 fill-cyan-500 text-white" />
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">/{agency.slug}</p>
          {data.teamScore.badge !== 'NONE' && (
            <div className="mt-2 flex justify-center">
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest',
                  data.teamScore.badge === 'TOP'
                    ? 'bg-amber-400/20 text-amber-600 dark:text-amber-400'
                    : 'bg-primary/15 text-primary',
                )}
              >
                {data.teamScore.badge === 'TOP' ? dt('★ Top Team') : dt('Rising Team')}
              </span>
            </div>
          )}
          {agency.bio && (
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{agency.bio}</p>
          )}
          {agency.website && (
            <a
              href={
                agency.website.startsWith('http') ? agency.website : `https://${agency.website}`
              }
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <ExternalLink className="h-3 w-3" /> {agency.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          <div className="mx-auto mt-4 grid max-w-md grid-cols-4 gap-2">
            {stat(String(stats.members), dt('Members'))}
            {stat(
              score.completedOrders > 0
                ? score.avgRating.toFixed(1)
                : stats.avgRating > 0
                  ? stats.avgRating.toFixed(1)
                  : '—',
              dt('Rating'),
            )}
            {stat(score.completedOrders > 0 ? `${score.onTimePct}%` : '—', dt('On time'))}
            {stat(String(score.completedOrders), dt('Team jobs'))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4">
        {/* Invite CTA — clients with open jobs can bring this team onto a job */}
        {isClientViewer && (
          <section className="pt-5">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Mail className="h-4 w-4 text-primary" /> {dt('Work with this team')}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {dt('Invite them to bid on one of your open jobs — free, no commitment.')}
              </p>
              {!inviteOpen ? (
                <Button
                  type="button"
                  size="sm"
                  variant="brand"
                  className="mt-2"
                  onClick={() => setInviteOpen(true)}
                >
                  {dt('Invite to bid')}
                </Button>
              ) : (
                <div className="mt-3 space-y-2">
                  {myJobs === null ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : myJobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {dt('You have no open jobs. Post one first, then invite teams.')}
                    </p>
                  ) : (
                    <>
                      <select
                        value={inviteJob}
                        onChange={(event) => setInviteJob(event.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
                      >
                        <option value="">{dt('Choose a job…')}</option>
                        {myJobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={inviteMsg}
                        onChange={(event) => setInviteMsg(event.target.value)}
                        rows={2}
                        maxLength={600}
                        placeholder={dt('Optional note to the team…')}
                        className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setInviteOpen(false)}
                        >
                          {dt('Cancel')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="brand"
                          onClick={sendInvite}
                          disabled={inviteAgency.isPending}
                        >
                          {inviteAgency.isPending && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}{' '}
                          {dt('Send invite')}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Team Score detail — only once the team has real completed work */}
        {score.completedOrders > 0 && (
          <section className="pt-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Timer className="h-3.5 w-3.5" /> {dt('Team score')}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stat(String(score.completedOrders), dt('Jobs completed'))}
              {stat(score.avgRating > 0 ? score.avgRating.toFixed(1) : '—', dt('Client rating'))}
              {stat(`${score.onTimePct}%`, dt('On-time delivery'))}
              {stat(`${score.repeatClientPct}%`, dt('Repeat clients'))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {dt(
                'Calculated only from this team’s completed orders and real client reviews. No self-reported numbers.',
              )}
            </p>
          </section>
        )}

        {/* Portfolio */}
        {data.portfolio.length > 0 && (
          <section className="pt-6">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" /> {dt('Team portfolio')}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.portfolio.map((project) => (
                <div
                  key={project.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className={cn('relative aspect-[16/10] w-full', gradientFor(project.id))}>
                    {project.imageUrl ? (
                      <Image
                        src={project.imageUrl}
                        alt={project.title}
                        fill
                        unoptimized
                        sizes="250px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-3xl">🏆</span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="line-clamp-1 text-xs font-bold">{project.title}</div>
                    {project.description && (
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 inline-block text-[10px] font-bold text-primary"
                      >
                        {dt('View link')}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {data.reviews.length > 0 && (
          <section className="pt-6">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Star className="h-3.5 w-3.5" /> {dt('What clients say')}
            </h2>
            <div className="space-y-2">
              {data.reviews.map((review, index) => (
                <div key={index} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {review.rating}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      · {review.author.fullName.split(' ')[0]}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Members */}
        <section className="pt-6">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {dt('Team members')}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {agency.members.map((m) => (
              <Link
                key={m.user.id}
                href={`/u/${m.user.username}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
              >
                {m.user.avatarUrl ? (
                  <Image
                    src={m.user.avatarUrl}
                    alt={m.user.fullName}
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white',
                      gradientFor(m.user.id),
                    )}
                  >
                    {m.user.fullName[0]?.toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-bold">
                    <span className="truncate">{m.user.fullName}</span>
                    {m.user.isPhoneVerified && m.user.isIdVerified && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-cyan-400 text-white" />
                    )}
                  </span>
                  {m.user.title && (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {m.user.title}
                    </span>
                  )}
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {m.user.ratingCount > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {m.user.rating.toFixed(1)} ({m.user.ratingCount})
                      </span>
                    )}
                    {m.user.city && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" /> {m.user.city}
                      </span>
                    )}
                    <span>
                      · {m.user.completedOrders} {dt('orders')}
                    </span>
                  </span>
                </span>
                {m.role !== 'MEMBER' && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                    {m.role}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* Gigs */}
        <section className="pt-7">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> {dt('Gigs from this team')}
          </h2>
          {gigs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {dt('No active gigs yet')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gigs.map((g) => {
                const catIcon = CATEGORIES.find((c) => c.id === g.categoryId)?.icon ?? '✨';
                return (
                  <Link
                    key={g.id}
                    href={`/gigs/${g.slug}`}
                    className="group overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border transition-all hover:shadow-lg hover:ring-primary/40"
                  >
                    <div
                      className={cn(
                        'relative aspect-[16/10] w-full overflow-hidden',
                        gradientFor(g.id),
                      )}
                    >
                      {g.coverImageUrl ? (
                        <Image
                          src={g.coverImageUrl}
                          alt={g.title}
                          fill
                          unoptimized
                          sizes="250px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-4xl">
                          {catIcon}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="line-clamp-2 min-h-[2.3rem] text-xs font-bold leading-snug">
                        {g.title}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="truncate text-[10px] text-muted-foreground">
                          {g.owner.fullName.split(' ')[0]}
                        </span>
                        <span className="text-xs font-extrabold tabular-nums text-primary">
                          {formatEtb(g.startingPriceEtb)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
