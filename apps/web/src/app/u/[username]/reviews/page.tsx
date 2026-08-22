'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Star, Loader2 } from 'lucide-react';
import { usePublicUser } from '@/hooks/use-public-user';
import { useUserReviews } from '@/hooks/use-reviews';
import { useI18n } from '@/i18n';
import { cn, timeAgo } from '@/lib/utils';

export default function AllReviewsPage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { data: user } = usePublicUser(username);
  const { data, isLoading } = useUserReviews(user?.id);
  const items = data?.items ?? [];

  const dist: number[] = [0, 0, 0, 0, 0];
  items.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      const idx = 5 - r.rating;
      dist[idx] = (dist[idx] ?? 0) + 1;
    }
  });
  const total = items.length;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('review.reviewsHeading')}</h1>
      </header>

      {user && (
        <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="text-center">
              <div className="text-4xl font-extrabold text-primary">
                {user.rating > 0 ? user.rating.toFixed(1) : '—'}
              </div>
              <div className="mt-1 flex justify-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3 w-3',
                      i < Math.round(user.rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30',
                    )}
                  />
                ))}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{user.ratingCount} reviews</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {dist.map((n, i) => {
                const stars = 5 - i;
                const pct = total ? (n / total) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 text-muted-foreground">{stars}</span>
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted-foreground">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="mx-3 mt-4 space-y-2">
        {isLoading && (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Star className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No reviews yet</p>
          </div>
        )}
        {items.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              {r.author.avatarUrl ? (
                <Image src={r.author.avatarUrl} alt={r.author.fullName} width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="grad-hero grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold text-white">
                  {(r.author.fullName[0] ?? '?').toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{r.author.fullName}</div>
                <div className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</div>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn('h-3 w-3', i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                ))}
              </div>
            </div>
            {r.comment && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
