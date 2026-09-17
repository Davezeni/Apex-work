'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { Briefcase, Loader2, Plus, Search, MapPin } from 'lucide-react';
import { useJobs, type JobSummary } from '@/hooks/use-jobs';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { cn, formatEtb, timeAgo } from '@/lib/utils';
import { CATEGORIES } from '@apex-work/shared';
import { MobileShell } from '@/components/mobile/mobile-shell';
export function JobsBoard() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me } = useMe();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const { data, isLoading } = useJobs({ q: q || undefined, category });

  const items: JobSummary[] = data?.items ?? [];

  return (
    <>
      <div className="mx-auto min-h-dvh w-full max-w-5xl bg-background pb-24">
        <header className="safe-top sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">{t('jobs.title')}</h1>
              <p className="text-[11px] text-muted-foreground">{t('jobs.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile theme toggle — desktop gets the shell-level one. */}
              <div className="md:hidden">
                <ThemeToggle />
              </div>
              <button
                onClick={() => router.push('/jobs/new')}
                aria-label={t('jobs.postJob')}
                className="grad-hero grid h-10 w-10 place-items-center rounded-full text-white shadow-md shadow-primary/40 active:scale-90 md:hidden"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('common.search')}
              className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
          </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible">
            <CategoryChip
              label={dt('All')}
              icon="✨"
              active={!category}
              onClick={() => setCategory(undefined)}
            />
            {CATEGORIES.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.label}
                icon={c.icon}
                active={category === c.id}
                onClick={() => setCategory(c.id === category ? undefined : c.id)}
              />
            ))}
          </div>
        </header>

        {isLoading && (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="mx-4 mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-sm font-semibold">{t('jobs.empty')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('jobs.emptyBody')}</p>
            <button
              onClick={() => router.push('/jobs/new')}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white"
            >
              {t('jobs.postJob')}
            </button>
          </div>
        )}

        <div className="mx-3 mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((job) => (
            <JobCard key={job.id} job={job} isMe={me?.id === job.client.id} />
          ))}
        </div>
      </div>
    </>
  );
}

export default function JobsPage() {
  return (
    <MobileShell>
      <JobsBoard />
    </MobileShell>
  );
}

function CategoryChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground',
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function JobCard({ job, isMe }: { job: JobSummary; isMe: boolean }) {
  const { t } = useI18n();
  const budget =
    job.budgetMinEtb != null && job.budgetMaxEtb != null
      ? t('jobs.budgetRange', {
          min: formatEtb(job.budgetMinEtb),
          max: formatEtb(job.budgetMaxEtb),
        })
      : job.budgetMinEtb != null
        ? `≥ ${formatEtb(job.budgetMinEtb)}`
        : job.budgetMaxEtb != null
          ? `≤ ${formatEtb(job.budgetMaxEtb)}`
          : t('jobs.budgetOpen');
  const cover = job.attachments?.find((a) => a.contentType.startsWith('image/'))?.url;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-2xl border border-border bg-card p-4 transition-colors active:bg-muted"
    >
      {cover && (
        <div className="relative mb-3 h-36 w-full overflow-hidden rounded-xl bg-muted">
          <Image
            src={cover}
            alt={job.title}
            fill
            unoptimized
            sizes="400px"
            className="object-cover"
          />
        </div>
      )}
      <div className="flex items-start gap-3">
        {job.client.avatarUrl ? (
          <Image
            src={job.client.avatarUrl}
            alt={job.client.fullName}
            width={36}
            height={36}
            unoptimized
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="grad-hero grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white">
            {(job.client.fullName[0] ?? '?').toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold">
              {isMe ? 'You' : job.client.fullName}
            </span>
            <span className="text-[10px] text-muted-foreground">· {timeAgo(job.createdAt)}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-extrabold leading-snug">{job.title}</h3>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
          {budget}
        </span>
        {job.isRemote && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            <MapPin className="h-2.5 w-2.5" /> {t('jobs.remote')}
          </span>
        )}
        <span className="text-muted-foreground">
          ·{' '}
          {job._count.bids === 0
            ? t('jobs.bidsZero')
            : job._count.bids === 1
              ? t('jobs.bidsOne')
              : t('jobs.bids', { n: job._count.bids })}
        </span>
      </div>

      {job.requiredSkills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {job.requiredSkills.slice(0, 4).map((s) => (
            <span
              key={s}
              className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              #{s}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
